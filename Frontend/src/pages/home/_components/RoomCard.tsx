import { Link } from "react-router-dom";
import { paths } from "../../../app/routes/paths";
import { useEffect, useMemo, useState, useCallback } from "react";

type RoomCardVariant = "purple" | "blue" | "green" | "orange" | "gray";

interface RoomCardProps {
  title: string;
  imageSrc?: string;
  capacityText?: string;
  tagsText?: string;
  badgeText?: string; // kept for backwards-compat (rooms 페이지)
  variant?: RoomCardVariant;
  to?: string;
  // Home 전용 확장 props
  participants?: { current: number; capacity: number };
  startTime?: string; // e.g., "18:10"
  size?: "small" | "medium" | "large"; // 썸네일 선택과 태그 구성에 사용
  venueName?: string; // 공연장 이름
  ongoing?: boolean; // 경기 진행중 여부
}

const VARIANT_GRADIENT: Record<RoomCardVariant, { from: string; to: string }> =
  {
    // Approximate Tailwind colors
    purple: { from: "#a855f7", to: "#6366f1" },
    blue: { from: "#0ea5e9", to: "#2563eb" },
    green: { from: "#10b981", to: "#22c55e" },
    orange: { from: "#f97316", to: "#ef4444" },
    gray: { from: "#64748b", to: "#6b7280" },
  };

const VARIANT_BADGE_BG: Record<RoomCardVariant, string> = {
  purple: "#7c3aed",
  blue: "#3b82f6",
  green: "#10b981",
  orange: "#f97316",
  gray: "#6b7280",
};

export default function RoomCard({
  title,
  imageSrc,
  capacityText = "어려움  |  최대 10명  |  봇 3000명",
  tagsText,
  badgeText,
  variant = "purple",
  to = paths.iTicket,
  participants,
  startTime,
  size,
  venueName,
  ongoing,
}: RoomCardProps) {
  const gradient = VARIANT_GRADIENT[variant];
  const badgeBg = VARIANT_BADGE_BG[variant];
  // Default badge text by variant (blue/orange/green only)
  const DEFAULT_BADGE_BY_VARIANT: Partial<Record<RoomCardVariant, string>> = {
    blue: "익스터파크",
    orange: "NO24",
    green: "멜론티켓",
  };
  const displayedBadge = DEFAULT_BADGE_BY_VARIANT[variant] ?? badgeText;

  // 이미지 소스: size가 지정되면 매핑 이미지 사용
  const imageBySize: Record<NonNullable<typeof size>, string> = {
    small: "/performance-halls/charlotte-theater.jpg",
    medium: "/performance-halls/olympic-hall.jpg",
    large: "/performance-halls/inspire-arena.jpg",
  };
  const resolvedImageSrc =
    imageSrc ?? (size ? imageBySize[size] : "/temp-seats.jpg");

  // 태그 텍스트: size + venueName가 있으면 덮어쓰기
  const sizeToKorean: Record<NonNullable<typeof size>, string> = {
    small: "소형",
    medium: "중형",
    large: "대형",
  };
  const resolvedTagsText =
    tagsText ??
    (size && venueName
      ? `${sizeToKorean[size]}  |  ${venueName}`
      : "돔형 콘서트장  |  커스텀");

  // 이미지에서 주요 색상 추출
  const [extractedColors, setExtractedColors] = useState<string[] | null>(null);

  // K-means 클러스터링 함수
  const kmeans = (points: { r: number; g: number; b: number }[], k: number) => {
    if (points.length === 0) return [];

    let centers: { r: number; g: number; b: number }[] = [];
    for (let i = 0; i < k && i < points.length; i++) {
      centers.push({ ...points[Math.floor(Math.random() * points.length)] });
    }

    for (let iter = 0; iter < 10; iter++) {
      const clusters = Array(k)
        .fill(null)
        .map(() => [] as { r: number; g: number; b: number }[]);

      points.forEach((point) => {
        let minDist = Infinity;
        let minIdx = 0;

        centers.forEach((center, idx) => {
          const dist = Math.sqrt(
            Math.pow(point.r - center.r, 2) +
              Math.pow(point.g - center.g, 2) +
              Math.pow(point.b - center.b, 2)
          );
          if (dist < minDist) {
            minDist = dist;
            minIdx = idx;
          }
        });

        clusters[minIdx].push(point);
      });

      centers = clusters.map((cluster) => {
        if (cluster.length === 0) return centers[0];
        return {
          r: cluster.reduce((sum, p) => sum + p.r, 0) / cluster.length,
          g: cluster.reduce((sum, p) => sum + p.g, 0) / cluster.length,
          b: cluster.reduce((sum, p) => sum + p.b, 0) / cluster.length,
        };
      });
    }

    return centers;
  };

  // 이미지에서 색상 추출 함수
  const extractColors = useCallback(
    (imageUrl: string): Promise<string[]> => {
      return new Promise((resolve) => {
        const img = new Image();
        // 같은 도메인 이미지면 crossOrigin 설정 불필요 (CORS 오류 방지)
        if (!imageUrl.startsWith("/") && !imageUrl.startsWith("./")) {
          img.crossOrigin = "anonymous";
        }
        img.src = imageUrl;

        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");

            if (!ctx) {
              resolve([gradient.from, gradient.to]);
              return;
            }

            const maxSize = 100;
            const scale = Math.min(maxSize / img.width, maxSize / img.height);
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            const sampleSize = 10;
            const samples: { r: number; g: number; b: number }[] = [];

            for (let i = 0; i < sampleSize; i++) {
              for (let j = 0; j < sampleSize; j++) {
                const x = Math.floor((canvas.width / sampleSize) * i);
                const y = Math.floor((canvas.height / sampleSize) * j);

                try {
                  const pixel = ctx.getImageData(x, y, 1, 1).data;
                  const brightness = (pixel[0] + pixel[1] + pixel[2]) / 3;

                  if (brightness > 40 && brightness < 220) {
                    samples.push({
                      r: pixel[0],
                      g: pixel[1],
                      b: pixel[2],
                    });
                  }
                } catch (e) {
                  console.log("Pixel read error:", e);
                }
              }
            }

            if (samples.length > 0) {
              const colors = kmeans(samples, 2);
              resolve(
                colors.map(
                  (c) =>
                    `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`
                )
              );
            } else {
              resolve([gradient.from, gradient.to]);
            }
          } catch (error) {
            console.error("Color extraction error:", error);
            resolve([gradient.from, gradient.to]);
          }
        };

        img.onerror = (error) => {
          console.error("Image load error:", error);
          resolve([gradient.from, gradient.to]);
        };
      });
    },
    [gradient.from, gradient.to]
  );

  // 포스터 이미지에서 색상 추출
  useEffect(() => {
    let cancelled = false;
    async function extract() {
      try {
        const colors = await extractColors(resolvedImageSrc);
        if (!cancelled) {
          setExtractedColors(colors);
        }
      } catch (error) {
        console.error("Color extraction failed:", error);
        if (!cancelled) setExtractedColors(null);
      }
    }
    extract();
    return () => {
      cancelled = true;
    };
  }, [resolvedImageSrc, extractColors]);

  // Hex 색상을 rgba로 변환하는 헬퍼 함수
  const hexToRgba = (hex: string, alpha: number = 1): string => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      const r = parseInt(result[1], 16);
      const g = parseInt(result[2], 16);
      const b = parseInt(result[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return hex; // 파싱 실패 시 원본 반환
  };

  // 추출된 색상으로 좌측 배경 그라데이션 생성 (좌측 불투명 → 우측 투명)
  const getGradientStyle = (): string => {
    if (extractedColors && extractedColors.length > 0) {
      const color1 = extractedColors[0];
      const color2 = extractedColors[1] || extractedColors[0];
      // RGB 값 추출
      const rgb1 = color1.match(/\d+/g);
      const rgb2 = color2.match(/\d+/g);
      if (rgb1 && rgb2 && rgb1.length === 3 && rgb2.length === 3) {
        return `linear-gradient(to right, rgba(${rgb1[0]}, ${rgb1[1]}, ${rgb1[2]}, 1) 0%, rgba(${rgb2[0]}, ${rgb2[1]}, ${rgb2[2]}, 0) 100%)`;
      }
    }
    // 기본값: variant 색상 사용 (좌측 불투명 → 우측 완전 투명)
    return `linear-gradient(to right, ${hexToRgba(gradient.from, 1)} 0%, ${hexToRgba(gradient.to, 0)} 100%)`;
  };

  // 호버 시 카드 전체 배경색 생성 (추출된 색상 또는 variant 색상)
  const getHoverBackgroundStyle = (): string => {
    if (extractedColors && extractedColors.length > 0) {
      const color = extractedColors[0];
      const rgb = color.match(/\d+/g);
      if (rgb && rgb.length === 3) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.1)`;
      }
    }
    // 기본값: variant 색상 사용
    return hexToRgba(gradient.from, 0.1);
  };

  // 우측 정보 영역에서 사용할 참가 인원 텍스트
  const participantsText = useMemo(() => {
    if (!participants) return null;
    return `${participants.current} / ${participants.capacity}명`;
  }, [participants]);

  // 꽉 찬 방 여부 및 오버레이 라벨 결정
  const isFull =
    !!participants && participants.current >= participants.capacity;
  const overlayLabel = ongoing ? "경기 진행중" : isFull ? "최대 인원" : null;

  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl bg-white shadow-md transition hover:shadow-lg"
      aria-label={`${title} 연습 방 입장`}
    >
      {/* 호버 시 카드 전체 배경색 오버레이 */}
      <div
        className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none rounded-xl"
        style={{
          background: getHoverBackgroundStyle(),
        }}
      />
      <div className="relative flex gap-4 p-4">
        {/* 좌측 배경 영역 - 추출된 색상 그라데이션 (포스터 영역까지만) */}
        <div
          className="absolute left-0 top-0 bottom-0 w-[120px] sm:w-[140px] md:w-[160px]"
          style={{
            background: getGradientStyle(),
            borderTopLeftRadius: "0.75rem",
            borderBottomLeftRadius: "0.75rem",
          }}
        />

        {/* Left: Poster area */}
        <div className="relative w-[120px] sm:w-[140px] md:w-[160px] aspect-[3/4] shrink-0 z-10">
          <div
            className="relative w-full h-full overflow-hidden rounded-lg"
            style={{
              background: "rgba(255, 255, 255, 0.95)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            <img
              src={resolvedImageSrc}
              alt="포스터 이미지"
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            {overlayLabel ? (
              <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center bg-[#4F4F4F]/50 backdrop-blur-[2px]">
                <span className="text-white text-lg font-extrabold">
                  {overlayLabel}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Right: Info area */}
        <div className="relative min-w-0 flex-1 z-10 flex flex-col">
          {/* Top line: 배지(왼쪽)와 참가 인원(오른쪽) */}
          <div className="flex items-center justify-between mb-1">
            {displayedBadge ? (
              <span
                className="rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-medium text-white shadow-sm shrink-0"
                style={{ backgroundColor: badgeBg }}
              >
                {displayedBadge}
              </span>
            ) : null}
            {participantsText ? (
              <span className="text-sm text-gray-400">
                {participantsText}
              </span>
            ) : null}
          </div>

          {/* Main title */}
          <h3
            className="text-base sm:text-lg font-semibold text-black mb-2 truncate"
            title={title}
          >
            {title}
          </h3>

          {/* Separator line */}
          <div className="h-px bg-gray-300 mb-2" />

          {/* First detail line */}
          <div className="text-base text-gray-500 mb-1">
            {capacityText}
          </div>

          {/* Second detail line */}
          <div className="text-base text-gray-500 mb-auto">
            {resolvedTagsText}
          </div>

          {/* Bottom right: 시간 표시 (time.svg 배경) */}
          {startTime ? (
            <div className="relative mt-auto flex justify-end">
              <div className="relative">
                {/* time.svg 배경 */}
                <img
                  src="/time.svg"
                  alt=""
                  className="h-[40px] w-auto"
                  style={{ minWidth: "160px" }}
                />
                {/* 시간 텍스트 오버레이 */}
                <div className="absolute inset-0 flex items-center justify-center pr-3">
                  <span className="text-white text-sm font-semibold">
                    시작: {startTime}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-auto flex justify-end">
              <span className="text-sm text-gray-500">상시</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
