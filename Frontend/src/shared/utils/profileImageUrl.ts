/**
 * 프로필 이미지 URL을 정규화합니다.
 * S3 URL 형식: https://s3.tickget.kr/tickget-dev/users/{userId}/profile
 *
 * - URL이 있으면 정규화하여 반환
 * - URL이 없고 userId가 있으면 S3 경로 생성: https://s3.tickget.kr/tickget-dev/users/{userId}/profile
 */
export function normalizeProfileImageUrl(
  url: string | null | undefined,
  userId?: number | null
): string | null {
  // URL이 없고 userId가 있으면 S3 경로 생성
  if (!url && userId != null && userId > 0) {
    const generatedUrl = `https://s3.tickget.kr/tickget-dev/users/${userId}/profile`;
    if (import.meta.env.DEV) {
      console.log("🔍 [프로필 이미지 URL 생성]:", {
        userId,
        generatedUrl,
      });
    }
    return generatedUrl;
  }

  // URL이 없으면 null 반환
  if (!url) return null;

  let processedUrl = url;

  // 이미 완전한 URL인 경우
  if (/^https?:\/\//i.test(url)) {
    // 이미 완전한 URL이면 그대로 반환 (tickget-dev 포함)
    if (import.meta.env.DEV) {
      console.log("🔍 [프로필 이미지 URL 정규화]:", {
        original: url,
        normalized: processedUrl,
      });
    }

    return processedUrl;
  }

  // 상대 경로인 경우
  // tickget-dev/users/{userId}/profile -> https://s3.tickget.kr/tickget-dev/users/{userId}/profile
  let path = url.replace(/^\//, "");
  // tickget-dev/가 없으면 추가
  if (!path.startsWith("tickget-dev/")) {
    path = `tickget-dev/${path}`;
  }
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
