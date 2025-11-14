/**
 * 프로필 이미지 URL을 정규화합니다.
 * S3 URL 형식: https://s3.tickget.kr/tickget-dev/users/{userId}/profile
 *
 * - URL이 있으면 정규화하여 반환
 * - URL이 없고 userId가 있으면 S3 경로 생성: https://s3.tickget.kr/tickget-dev/users/{userId}/profile
 * - cacheBust가 true이면 타임스탬프 쿼리 파라미터를 추가하여 캐시 무효화
 */
export function normalizeProfileImageUrl(
  url: string | null | undefined,
  userId?: number | null,
  cacheBust?: boolean
): string | null {
  // URL이 없고 userId가 있으면 S3 경로 생성
  if (!url && userId != null && userId > 0) {
    let generatedUrl = `https://s3.tickget.kr/tickget-dev/users/${userId}/profile`;
    // 캐시 무효화를 위해 타임스탬프 추가
    if (cacheBust) {
      generatedUrl += `?t=${Date.now()}`;
    }
    if (import.meta.env.DEV) {
      console.log("🔍 [프로필 이미지 URL 생성]:", {
        userId,
        generatedUrl,
        cacheBust,
      });
    }
    return generatedUrl;
  }

  // URL이 없으면 null 반환
  if (!url) return null;

  let processedUrl = url;

  // data URL인 경우 (data:image/..., data:text/... 등) 그대로 반환
  if (/^data:/i.test(url)) {
    if (import.meta.env.DEV) {
      console.log("🔍 [프로필 이미지 URL 정규화]: data URL 감지, 그대로 반환", {
        original: url.substring(0, 50) + "...",
      });
    }
    return url;
  }

  // 이미 완전한 URL인 경우
  if (/^https?:\/\//i.test(url)) {
    // 캐시 무효화를 위해 타임스탬프 추가
    if (cacheBust) {
      const urlObj = new URL(processedUrl);
      urlObj.searchParams.set("t", String(Date.now()));
      processedUrl = urlObj.toString();
    }
    // 이미 완전한 URL이면 그대로 반환 (tickget-dev 포함)
    if (import.meta.env.DEV) {
      console.log("🔍 [프로필 이미지 URL 정규화]:", {
        original: url,
        normalized: processedUrl,
        cacheBust,
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
  let normalized = `https://s3.tickget.kr/${path}`;

  // 캐시 무효화를 위해 타임스탬프 추가
  if (cacheBust) {
    normalized += `?t=${Date.now()}`;
  }

  // 디버깅: 개발 환경에서 URL 확인
  if (import.meta.env.DEV) {
    console.log("🔍 [프로필 이미지 URL 정규화]:", {
      original: url,
      normalized: normalized,
      cacheBust,
    });
  }

  return normalized;
}
