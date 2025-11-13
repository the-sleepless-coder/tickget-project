/**
 * 이미지 리사이징 및 압축 유틸리티
 */

interface ResizeImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  maxSizeMB?: number;
  quality?: number;
}

/**
 * canvas.toBlob을 Promise로 변환
 */
function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("이미지 압축에 실패했습니다."));
        }
      },
      type,
      quality
    );
  });
}

/**
 * 이미지 파일을 리사이징하고 압축하여 10MB 이하로 만듭니다.
 * @param file 원본 이미지 파일
 * @param options 리사이징 옵션
 * @returns 압축된 File 객체
 */
export async function compressImage(
  file: File,
  options: ResizeImageOptions = {}
): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    maxSizeMB = 10,
    quality = 0.9,
  } = options;

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  // 10MB 이하면 그대로 반환
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const img = new Image();
        img.onload = async () => {
          try {
            // 캔버스 생성
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              reject(new Error("Canvas context를 가져올 수 없습니다."));
              return;
            }

            // 이미지 비율 유지하며 리사이징
            let width = img.width;
            let height = img.height;

            if (width > maxWidth || height > maxHeight) {
              const ratio = Math.min(maxWidth / width, maxHeight / height);
              width = width * ratio;
              height = height * ratio;
            }

            canvas.width = width;
            canvas.height = height;

            // 이미지 그리기
            ctx.drawImage(img, 0, 0, width, height);

            // 압축 품질 조정하며 파일 크기 확인
            let currentQuality = quality;
            const imageType = file.type || "image/jpeg";

            while (currentQuality >= 0.1) {
              const blob = await canvasToBlob(
                canvas,
                imageType,
                currentQuality
              );

              // 목표 크기 이하면 완료
              if (blob.size <= maxSizeBytes) {
                const compressedFile = new File([blob], file.name, {
                  type: imageType,
                  lastModified: Date.now(),
                });
                resolve(compressedFile);
                return;
              }

              // 크기가 여전히 크면 품질을 낮춰서 다시 시도
              currentQuality = Math.max(0.1, currentQuality - 0.1);
            }

            // 최소 품질로도 크기가 크면 최소 품질로 반환
            const finalBlob = await canvasToBlob(canvas, imageType, 0.1);
            const compressedFile = new File([finalBlob], file.name, {
              type: imageType,
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => {
          reject(new Error("이미지를 로드할 수 없습니다."));
        };

        if (e.target?.result) {
          img.src = e.target.result as string;
        }
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("파일을 읽을 수 없습니다."));
    };

    reader.readAsDataURL(file);
  });
}
