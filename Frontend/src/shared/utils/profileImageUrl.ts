/**
 * 프로필 이미지 URL을 정규화합니다.
 * S3 URL 형식: https://s3.tickget.kr/users/{userId}/profile
 * 또는 상대 경로: tickget-dev/users/{userId}/profile (tickget-dev 제거)
 *
 * img 태그로 직접 요청하면 CORS나 인증 문제가 있을 수 있지만,
 * 일단 원래 S3 URL 형식으로 반환합니다.
 */
export function normalizeProfileImageUrl(
  url: string | null | undefined,
  userId?: number | null
): string | null {
  if (!url) return null;

  let processedUrl = url;

  // 이미 완전한 URL인 경우
  if (/^https?:\/\//i.test(url)) {
    // tickget-dev/ 제거 (https://s3.tickget.kr/tickget-dev/users/2/profile -> https://s3.tickget.kr/users/2/profile)
    processedUrl = url.replace(/\/tickget-dev\//, "/");

    if (import.meta.env.DEV) {
      console.log("🔍 [프로필 이미지 URL 정규화]:", {
        original: url,
        normalized: processedUrl,
      });
    }

    return processedUrl;
  }

  // 상대 경로인 경우
  // tickget-dev/users/{userId}/profile -> users/{userId}/profile -> https://s3.tickget.kr/users/{userId}/profile
  let path = url.replace(/^\//, "");
  // tickget-dev/ 제거
  path = path.replace(/^tickget-dev\//, "");
  const normalized = `https://s3.tickget.kr/${path}`;

  // 디버깅: 개발 환경에서 URL 확인
  if (import.meta.env.DEV) {
    console.log("🔍 [프로필 이미지 URL 정규화]:", {
      original: url,
      normalized: normalized,
    });
  }

  return normalized;
}
