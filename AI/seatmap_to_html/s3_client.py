"""
MinIO S3 클라이언트 (TickGet 프로젝트용 - 업데이트 버전)

파일 저장 방식: 직접 저장 (공개 URL)

폴더 구조:
- tickget-dev/users/{user_id}/profile_image.png
- tickget-dev/halls/presets/{small|medium|large}/{hall_name}/hall.html
- tickget-dev/halls/ai/{room_id}/hall.html
- tickget-dev2/halls/{hall_name}.html (간편 버전)

Author: TickGet Team
"""

from minio import Minio
from minio.error import S3Error
import os
import json
from datetime import datetime
from typing import Optional, Dict, Any
import logging

logger = logging.getLogger(__name__)


class S3Client:
    """MinIO S3 클라이언트"""

    def __init__(
        self,
        endpoint: str = None,
        access_key: str = None,
        secret_key: str = None,
        bucket: str = None,
        secure: bool = True  # ✅ HTTPS 사용
    ):
        """
        S3 클라이언트 초기화

        Args:
            endpoint: MinIO 엔드포인트 (기본값: s3.tickget.kr)
            access_key: Access Key
            secret_key: Secret Key
            bucket: 버킷 이름 (기본값: tickget-dev)
            secure: HTTPS 사용 여부 (기본값: True)
        """
        self.endpoint = endpoint or os.getenv("MINIO_ENDPOINT", "s3.tickget.kr")
        self.access_key = access_key or os.getenv("MINIO_ACCESS_KEY")
        self.secret_key = secret_key or os.getenv("MINIO_SECRET_KEY")
        self.bucket = bucket or os.getenv("MINIO_BUCKET", "tickget-dev")
        self.secure = secure

        if not self.access_key or not self.secret_key:
            raise ValueError("MINIO_ACCESS_KEY and MINIO_SECRET_KEY must be set")

        # MinIO 클라이언트 생성
        self.client = Minio(
            self.endpoint,
            access_key=self.access_key,
            secret_key=self.secret_key,
            secure=self.secure
        )

        logger.info(f"S3 Client initialized: endpoint={self.endpoint}, bucket={self.bucket}")

    def upload_profile_image(
        self,
        user_id: int,
        image_path: str
    ) -> str:
        """
        사용자 프로필 이미지 업로드

        저장 경로: users/{user_id}/profile_image.{ext}

        Args:
            user_id: 사용자 ID
            image_path: 로컬 이미지 파일 경로

        Returns:
            공개 URL (DB에 저장할 URL)
            예: https://s3.tickget.kr/tickget-dev/users/123/profile_image.png
        """
        # 확장자 추출
        extension = os.path.splitext(image_path)[1]

        # 저장 경로
        object_name = f"users/{user_id}/profile_image{extension}"

        # Content-Type 자동 감지
        content_type = self._get_content_type(image_path)

        # 파일 업로드
        self.client.fput_object(
            self.bucket,
            object_name,
            image_path,
            content_type=content_type
        )

        logger.info(f"Uploaded profile image: {object_name}")

        # 공개 URL 반환
        return self.get_public_url(object_name)

    def upload_preset_hall(
        self,
        size: str,  # "small", "medium", "large"
        hall_name: str,
        html_content: str,
        metadata: Dict[str, Any]
    ) -> str:
        """
        Preset 공연장 HTML 및 JSON 업로드

        저장 경로:
        - halls/presets/{size}/{hall_name}/{hall_name}.html
        - halls/presets/{size}/{hall_name}/{hall_name}.json

        Args:
            size: 공연장 크기 (small, medium, large)
            hall_name: 공연장 이름
            html_content: HTML 파일 내용
            metadata: JSON 메타데이터 (dict)

        Returns:
            HTML 파일의 공개 URL
        """
        # HTML 업로드
        html_path = f"halls/presets/{size}/{hall_name}/{hall_name}.html"
        html_bytes = html_content.encode('utf-8')

        self.client.put_object(
            self.bucket,
            html_path,
            data=html_bytes,
            length=len(html_bytes),
            content_type='text/html; charset=utf-8'
        )

        # JSON 업로드
        json_path = f"halls/presets/{size}/{hall_name}/{hall_name}.json"
        json_content = json.dumps(metadata, ensure_ascii=False, indent=2)
        json_bytes = json_content.encode('utf-8')

        self.client.put_object(
            self.bucket,
            json_path,
            data=json_bytes,
            length=len(json_bytes),
            content_type='application/json; charset=utf-8'
        )

        logger.info(f"Uploaded preset hall: {html_path}")

        return self.get_public_url(html_path)

    def upload_ai_generated_hall(
        self,
        room_id: int,
        html_content: str,
        metadata: Dict[str, Any]
    ) -> str:
        """
        AI 생성 공연장 HTML 및 JSON 업로드

        저장 경로:
        - halls/ai/{room_id}/{room_id}.html
        - halls/ai/{room_id}/{room_id}.json

        Args:
            room_id: 방 ID
            html_content: HTML 파일 내용
            metadata: JSON 메타데이터 (dict)

        Returns:
            HTML 파일의 공개 URL
        """
        # HTML 업로드
        html_path = f"halls/ai/{room_id}/{room_id}.html"
        html_bytes = html_content.encode('utf-8')

        self.client.put_object(
            self.bucket,
            html_path,
            data=html_bytes,
            length=len(html_bytes),
            content_type='text/html; charset=utf-8'
        )

        # JSON 업로드
        json_path = f"halls/ai/{room_id}/{room_id}.json"
        json_content = json.dumps(metadata, ensure_ascii=False, indent=2)
        json_bytes = json_content.encode('utf-8')

        self.client.put_object(
            self.bucket,
            json_path,
            data=json_bytes,
            length=len(json_bytes),
            content_type='application/json; charset=utf-8'
        )

        logger.info(f"Uploaded AI hall: {html_path}")

        return self.get_public_url(html_path)

    def upload_simple_hall(
        self,
        hall_name: str,
        html_content: str,
        metadata: Dict[str, Any]
    ) -> str:
        """
        공연장 간편 업로드 (tickget-dev2 버킷용)

        저장 경로:
        - halls/{hall_name}.html
        - halls/{hall_name}.json

        Args:
            hall_name: 공연장 이름
            html_content: HTML 파일 내용
            metadata: JSON 메타데이터 (dict)

        Returns:
            HTML 파일의 공개 URL
        """
        # HTML 업로드
        html_path = f"halls/{hall_name}.html"
        html_bytes = html_content.encode('utf-8')

        self.client.put_object(
            self.bucket,
            html_path,
            data=html_bytes,
            length=len(html_bytes),
            content_type='text/html; charset=utf-8'
        )

        # JSON 업로드
        json_path = f"halls/{hall_name}.json"
        json_content = json.dumps(metadata, ensure_ascii=False, indent=2)
        json_bytes = json_content.encode('utf-8')

        self.client.put_object(
            self.bucket,
            json_path,
            data=json_bytes,
            length=len(json_bytes),
            content_type='application/json; charset=utf-8'
        )

        logger.info(f"Uploaded simple hall: {html_path}")

        return self.get_public_url(html_path)

    def delete_user_profile(self, user_id: int) -> None:
        """사용자 프로필 이미지 삭제"""
        prefix = f"users/{user_id}/"
        self._delete_objects_with_prefix(prefix)

    def delete_ai_hall(self, room_id: int) -> None:
        """AI 생성 공연장 삭제"""
        prefix = f"halls/ai/{room_id}/"
        self._delete_objects_with_prefix(prefix)

    def delete_simple_hall(self, hall_name: str) -> None:
        """간편 공연장 삭제"""
        try:
            self.client.remove_object(self.bucket, f"halls/{hall_name}.html")
            logger.info(f"Deleted: halls/{hall_name}.html")
        except S3Error:
            pass

        try:
            self.client.remove_object(self.bucket, f"halls/{hall_name}.json")
            logger.info(f"Deleted: halls/{hall_name}.json")
        except S3Error:
            pass

    def _delete_objects_with_prefix(self, prefix: str) -> None:
        """특정 프리픽스의 모든 객체 삭제"""
        objects = self.client.list_objects(self.bucket, prefix=prefix, recursive=True)

        for obj in objects:
            self.client.remove_object(self.bucket, obj.object_name)
            logger.info(f"Deleted: {obj.object_name}")

    def get_public_url(self, object_name: str) -> str:
        """
        공개 URL 생성

        반환 예시:
        https://s3.tickget.kr/tickget-dev/users/123/profile_image.png
        https://s3.tickget.kr/tickget-dev/halls/presets/small/hall1/hall1.html

        이 URL을 DB에 저장하고 프론트엔드에서 직접 사용!
        """
        protocol = "https" if self.secure else "http"
        return f"{protocol}://{self.endpoint}/{self.bucket}/{object_name}"

    def file_exists(self, object_name: str) -> bool:
        """파일 존재 여부 확인"""
        try:
            self.client.stat_object(self.bucket, object_name)
            return True
        except S3Error:
            return False

    def _get_content_type(self, filename: str) -> str:
        """Content-Type 자동 감지"""
        ext = os.path.splitext(filename)[1].lower()
        content_types = {
            '.html': 'text/html; charset=utf-8',
            '.json': 'application/json; charset=utf-8',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
        }
        return content_types.get(ext, 'application/octet-stream')


# 사용 예제
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # S3 클라이언트 생성
    s3 = S3Client()

    # 1. AI 생성 공연장 업로드 예제
    html = """
<!DOCTYPE html>
<html>
<head>
    <title>AI 생성 공연장</title>
    <meta charset="UTF-8">
</head>
<body>
    <h1>방 #12345 공연장</h1>
    <p>AI가 생성한 공연장입니다.</p>
</body>
</html>
    """

    metadata = {
        "room_id": 12345,
        "type": "AI_GENERATED",
        "capacity": 500,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    url = s3.upload_ai_generated_hall(
        room_id=12345,
        html_content=html,
        metadata=metadata
    )

    print(f"✅ AI 공연장 업로드 성공!")
    print(f"📎 HTML URL: {url}")
    print(f"📎 JSON URL: {url.replace('.html', '.json')}")
    print()
    print("이 URL을 DB에 저장하세요!")
