import React, { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useMatchStore } from "@features/booking-site/store";
import { useAuthStore } from "@features/auth/store";
import { getSectionSeatsStatus } from "@features/booking-site/api";
import Inspire_45 from "./seats-inspire-arena/S/Inspire_45";
import Inspire_46 from "./seats-inspire-arena/S/Inspire_46";
import Inspire_47 from "./seats-inspire-arena/S/Inspire_47";
import Inspire_49 from "./seats-inspire-arena/S/Inspire_49";
import Inspire_50 from "./seats-inspire-arena/S/Inspire_50";
import Inspire_52 from "./seats-inspire-arena/S/Inspire_52";
import Inspire_55 from "./seats-inspire-arena/S/Inspire_55";
import Inspire_56 from "./seats-inspire-arena/S/Inspire_56";
import Inspire_57 from "./seats-inspire-arena/S/Inspire_57";
import Inspire_5 from "./seats-inspire-arena/VIP/Inspire_5";
import Inspire_6 from "./seats-inspire-arena/VIP/Inspire_6";
import Inspire_7 from "./seats-inspire-arena/VIP/Inspire_7";
import Inspire_11 from "./seats-inspire-arena/VIP/Inspire_11";
import Inspire_12 from "./seats-inspire-arena/VIP/Inspire_12";
import Inspire_15 from "./seats-inspire-arena/VIP/Inspire_15";
import Inspire_16 from "./seats-inspire-arena/VIP/Inspire_16";
import Inspire_23 from "./seats-inspire-arena/VIP/Inspire_23";
import Inspire_25 from "./seats-inspire-arena/R/Inspire_25";
import Inspire_26 from "./seats-inspire-arena/R/Inspire_26";
import Inspire_27 from "./seats-inspire-arena/R/Inspire_27";
import Inspire_31 from "./seats-inspire-arena/R/Inspire_31";
import Inspire_39 from "./seats-inspire-arena/R/Inspire_39";
import Inspire_42 from "./seats-inspire-arena/R/Inspire_42";
import Inspire_43 from "./seats-inspire-arena/R/Inspire_43";
import Inspire_1 from "./seats-inspire-arena/STANDING/Inspire_1";

const LIGHT_GRAY = "#d4d4d8";

interface PolygonData {
  id: string;
  level: string;
  group: string;
  capacity: string;
  components: string;
  ratio: string;
  fill: string;
}

type PatternComponentProps = {
  className?: string;
  cellSize?: number;
  gap?: number;
  activeColor?: string;
  backgroundColor?: string;
  flipHorizontal?: boolean;
};

// 그리드 배열 데이터 (10행 x 28열)
// O = 주황색, G = 회색 (원래는 주황색), W = 흰색/비어있음
// 두 번째 이미지 설명 기준으로 구성:
// - 왼쪽 그룹: 상단 5열 4행 주황색 20개, 아래 왼쪽 3열 2행 회색 6개
// - 중앙 그룹: 부채꼴 형태, 상단 5행은 각각 10개, 6번째 행은 8개 (중앙 그룹 내에서 5,8번째 위치가 빈 공간), 그 아래로 줄어듦
// - 오른쪽 그룹: 왼쪽과 대칭 (상단 5열 4행 주황색 20개, 아래 오른쪽 3열 2행 회색 6개)

export interface LargeVenueRef {
  backToOverview: () => void;
  refreshSeatStatus: (sectionId: string, takenSeatIds: string[]) => void;
}

type LargeVenueSeat = {
  id: string;
  gradeLabel: string;
  label: string;
  price?: number;
};

export default function LargeVenue({
  onBackToOverview,
  selectedIds = [],
  onToggleSeat,
  readOnly = false, // 읽기 전용 모드: 선택된 좌석만 색상 표시, 나머지는 회색
}: {
  onBackToOverview?: React.MutableRefObject<LargeVenueRef | null>;
  selectedIds?: string[];
  onToggleSeat?: (seat: LargeVenueSeat) => void;
  readOnly?: boolean; // 읽기 전용 모드
} = {}) {
  // 외부에서 전체 보기로 돌아가기 위한 함수 노출
  useEffect(() => {
    if (onBackToOverview) {
      onBackToOverview.current = {
        backToOverview: () => {
          setShowDetailView(false);
        },
        refreshSeatStatus: (sectionId: string, takenSeatIds: string[]) => {
          // 특정 섹션의 TAKEN 또는 MY_RESERVED 좌석 상태를 업데이트
          setTakenSeats((prev) => {
            const merged = new Set(prev);
            takenSeatIds.forEach((id) => merged.add(id));
            return merged;
          });
        },
      };
    }
    return () => {
      if (onBackToOverview) {
        onBackToOverview.current = null;
      }
    };
  }, [onBackToOverview]);
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailViewColor, setDetailViewColor] = useState<string>("#FFCC10");
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedPattern, setSelectedPattern] =
    useState<React.ComponentType<PatternComponentProps> | null>(null);
  const [patternScale, setPatternScale] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const patternWrapperRef = useRef<HTMLDivElement>(null);
  const [selectedMeta, setSelectedMeta] = useState<{
    level: string;
    id: string;
    columns: number;
    rows: number;
    cellSize: number;
    gap: number;
  } | null>(null);

  // Enforce VIP color to #7C50E4 on overview SVG and add tooltips
  useEffect(() => {
    if (showDetailView) return; // only applies to overview SVG
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;

    // readOnly 모드일 때 사용자가 선택한 좌석이 있는 섹션 ID 추출
    const sectionsWithSeats = new Set<string>();
    if (readOnly && selectedIds.length > 0) {
      selectedIds.forEach((seatId) => {
        // seatId 형식: ${section}-${row}-${seat}
        const parts = seatId.split("-");
        if (parts.length >= 1) {
          sectionsWithSeats.add(parts[0]);
        }
      });
    }

    const vipPolygons = Array.from(
      svg.querySelectorAll('polygon[data-seat-level="VIP"]')
    ) as SVGPolygonElement[];
    vipPolygons.forEach((p) => {
      const fill = "#7C50E4";
      p.setAttribute("fill", fill);
      p.setAttribute("data-fill", fill);
      const existingStyle = p.getAttribute("style") || "";
      const styleWithoutFill = existingStyle
        .split(";")
        .filter((s) => s.trim() && !s.trim().startsWith("fill:"))
        .join(";");
      p.setAttribute("style", `fill:${fill};${styleWithoutFill}`);
    });

    // Fit the viewBox to all polygons so they fill the SVG area
    const polygons = Array.from(
      svg.querySelectorAll("polygon")
    ) as SVGPolygonElement[];
    if (polygons.length > 0) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      polygons.forEach((p) => {
        const b = p.getBBox();
        if (
          !isFinite(b.x) ||
          !isFinite(b.y) ||
          !isFinite(b.width) ||
          !isFinite(b.height)
        )
          return;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);

        // 브라우저 기본 툴팁 설정 (전체 뷰)
        const idAttr = p.getAttribute("data-id") || "";
        const level = p.getAttribute("data-seat-level") || "";

        // readOnly 모드일 때 사용자가 선택한 좌석이 없는 섹션은 회색 처리
        if (readOnly && idAttr !== "0" && sectionsWithSeats.size > 0) {
          if (!sectionsWithSeats.has(idAttr)) {
            const grayFill = LIGHT_GRAY;
            p.setAttribute("fill", grayFill);
            p.setAttribute("data-fill", grayFill);
            const existingStyle = p.getAttribute("style") || "";
            const styleWithoutFill = existingStyle
              .split(";")
              .filter((s) => s.trim() && !s.trim().startsWith("fill:"))
              .join(";");
            p.setAttribute("style", `fill:${grayFill};${styleWithoutFill}`);
          }
        }

        if (idAttr && idAttr !== "0" && level) {
          const gradeLabel = level === "STANDING" ? "스탠딩석" : `${level}석`;
          p.setAttribute("title", `[${gradeLabel}] ${idAttr}구역`);
        }
      });
      if (
        isFinite(minX) &&
        isFinite(minY) &&
        isFinite(maxX) &&
        isFinite(maxY)
      ) {
        const padding = 8;
        const vbX = minX - padding;
        const vbY = minY - padding;
        const vbW = Math.max(1, maxX - minX + padding * 2);
        const vbH = Math.max(1, maxY - minY + padding * 2);
        svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
      }
    }
  }, [showDetailView, readOnly, selectedIds]);

  // 패턴 크기 계산 함수
  const calculatePatternSize = (
    columns: number,
    rows: number,
    cellSize: number = 12,
    gap: number = 2
  ) => {
    const width = columns * cellSize + (columns - 1) * gap;
    const height = rows * cellSize + (rows - 1) * gap;
    return { width, height };
  };

  // 패턴 스케일 계산 함수
  const calculateScale = (
    patternWidth: number,
    patternHeight: number,
    containerWidth: number = 616, // 640 - 24 (padding)
    containerHeight: number = 596 // 620 - 24 (padding)
  ) => {
    const scaleX = containerWidth / patternWidth;
    const scaleY = containerHeight / patternHeight;
    return Math.min(scaleX, scaleY, 1); // 1을 넘지 않도록
  };

  // 커스텀 툴팁 핸들러 제거 (브라우저 기본 툴팁 사용)

  const [searchParams] = useSearchParams();
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const currentUserId = useAuthStore((s) => s.userId);
  // TAKEN 좌석 정보 저장 (section-row-col 형식의 seatId를 Set으로 저장)
  const [takenSeats, setTakenSeats] = useState<Set<string>>(new Set());

  const handlePolygonClick = async (polygon: SVGPolygonElement) => {
    // readOnly 모드일 때는 클릭 이벤트 무시
    if (readOnly) return;

    const data: PolygonData = {
      id: polygon.dataset.id || "",
      level: polygon.dataset.seatLevel || "",
      group: polygon.dataset.colorGroup || "",
      capacity: polygon.dataset.capacity || "",
      components: polygon.dataset.componentCount || "",
      ratio: polygon.dataset.ratio || "",
      fill: polygon.dataset.fill || "",
    };

    // 섹션 ID로 API 호출
    const sectionId = data.id;
    if (sectionId) {
      // matchId 결정: store 우선, 없으면 URL 파라미터에서 가져오기
      const matchIdParam = searchParams.get("matchId");
      const matchId =
        matchIdFromStore ??
        (matchIdParam && !Number.isNaN(Number(matchIdParam))
          ? Number(matchIdParam)
          : null);

      // userId 확인
      if (matchId && currentUserId) {
        try {
          const response = await getSectionSeatsStatus(
            matchId,
            sectionId,
            currentUserId
          );

          // TAKEN 또는 MY_RESERVED 상태인 좌석들을 Set에 저장 (section-row-col 형식)
          // MY_RESERVED는 다른 사용자가 예약한 좌석이므로 선택할 수 없음
          if (response.seats && response.seats.length > 0) {
            const taken = new Set<string>();
            response.seats.forEach((seat) => {
              if (seat.status === "TAKEN" || seat.status === "MY_RESERVED") {
                taken.add(seat.seatId);
              }
            });
            setTakenSeats((prev) => {
              const merged = new Set(prev);
              taken.forEach((id) => merged.add(id));
              return merged;
            });
          } else {
            console.warn(
              "[section-click] API 응답에 좌석 데이터가 없습니다:",
              response
            );
          }
        } catch (error) {
          console.error("[section-click] API 호출 실패:", error);
        }
      } else {
        console.warn(
          "[section-click] matchId 또는 userId가 없어 API 호출을 건너뜁니다.",
          { matchId, currentUserId }
        );
      }
    }

    // 좌석별 패턴 매핑 (패턴 정보 포함)
    const seatPatternMap: Record<
      string,
      {
        component: React.ComponentType<PatternComponentProps>;
        flip: boolean;
        columns: number;
        rows: number;
      }
    > = {
      // S 좌석 패턴
      "45": { component: Inspire_45, flip: false, columns: 40, rows: 10 },
      "46": { component: Inspire_46, flip: false, columns: 45, rows: 11 },
      "47": { component: Inspire_47, flip: false, columns: 19, rows: 11 },
      "48": { component: Inspire_52, flip: true, columns: 45, rows: 11 }, // 52 패턴의 좌우 반전
      "49": { component: Inspire_49, flip: false, columns: 22, rows: 11 },
      "50": { component: Inspire_50, flip: false, columns: 23, rows: 11 },
      "51": { component: Inspire_49, flip: true, columns: 22, rows: 11 }, // 49 패턴의 좌우 반전
      "52": { component: Inspire_52, flip: false, columns: 45, rows: 11 },
      "53": { component: Inspire_47, flip: true, columns: 19, rows: 11 }, // 47 패턴의 좌우 반전
      "54": { component: Inspire_46, flip: true, columns: 45, rows: 11 }, // 46 패턴의 좌우 반전
      "55": { component: Inspire_55, flip: false, columns: 40, rows: 10 },
      "56": { component: Inspire_56, flip: false, columns: 46, rows: 11 },
      "57": { component: Inspire_57, flip: false, columns: 9, rows: 11 },
      // VIP 좌석 패턴
      "5": { component: Inspire_5, flip: false, columns: 33, rows: 14 },
      "6": { component: Inspire_6, flip: false, columns: 11, rows: 13 },
      "7": { component: Inspire_7, flip: false, columns: 22, rows: 14 },
      "8": { component: Inspire_7, flip: false, columns: 22, rows: 14 },
      "9": { component: Inspire_7, flip: false, columns: 22, rows: 14 },
      "10": { component: Inspire_16, flip: true, columns: 9, rows: 11 }, // 16 패턴의 좌우 반전
      "11": { component: Inspire_11, flip: false, columns: 27, rows: 14 },
      "12": { component: Inspire_12, flip: false, columns: 18, rows: 13 },
      "13": { component: Inspire_23, flip: false, columns: 24, rows: 14 },
      "14": { component: Inspire_12, flip: true, columns: 18, rows: 13 }, // 12 패턴의 좌우 반전
      "15": { component: Inspire_15, flip: false, columns: 27, rows: 14 },
      "16": { component: Inspire_16, flip: false, columns: 9, rows: 11 },
      "17": { component: Inspire_7, flip: false, columns: 22, rows: 14 },
      "18": { component: Inspire_7, flip: false, columns: 22, rows: 14 },
      "19": { component: Inspire_7, flip: false, columns: 22, rows: 14 },
      "20": { component: Inspire_6, flip: true, columns: 11, rows: 13 }, // 6 패턴의 좌우 반전
      "21": { component: Inspire_5, flip: false, columns: 33, rows: 14 },
      "22": { component: Inspire_12, flip: false, columns: 18, rows: 13 },
      "23": { component: Inspire_23, flip: false, columns: 24, rows: 14 },
      "24": { component: Inspire_12, flip: true, columns: 18, rows: 13 }, // 12 패턴의 좌우 반전
      // R 좌석 패턴
      "25": { component: Inspire_25, flip: false, columns: 38, rows: 10 },
      "26": { component: Inspire_26, flip: false, columns: 26, rows: 13 },
      "27": { component: Inspire_27, flip: false, columns: 22, rows: 10 },
      "28": { component: Inspire_27, flip: false, columns: 22, rows: 10 },
      "29": { component: Inspire_27, flip: false, columns: 22, rows: 10 },
      "30": { component: Inspire_26, flip: true, columns: 26, rows: 13 }, // 26 패턴의 좌우 반전
      "31": { component: Inspire_31, flip: false, columns: 41, rows: 7 },
      "32": { component: Inspire_42, flip: false, columns: 34, rows: 13 },
      "33": { component: Inspire_43, flip: false, columns: 25, rows: 10 },
      "34": { component: Inspire_42, flip: true, columns: 34, rows: 13 }, // 42 패턴의 좌우 반전
      "35": { component: Inspire_25, flip: true, columns: 38, rows: 10 }, // 25 패턴의 좌우 반전
      "36": { component: Inspire_26, flip: false, columns: 26, rows: 13 },
      "37": { component: Inspire_39, flip: false, columns: 22, rows: 8 },
      "38": { component: Inspire_39, flip: false, columns: 22, rows: 8 },
      "39": { component: Inspire_39, flip: false, columns: 22, rows: 8 },
      "40": { component: Inspire_26, flip: true, columns: 26, rows: 13 }, // 26 패턴의 좌우 반전
      "41": { component: Inspire_25, flip: false, columns: 38, rows: 10 },
      "42": { component: Inspire_42, flip: false, columns: 34, rows: 13 },
      "43": { component: Inspire_43, flip: false, columns: 25, rows: 10 },
      "44": { component: Inspire_42, flip: true, columns: 34, rows: 13 }, // 42 패턴의 좌우 반전
      // STANDING 좌석 패턴
      "1": { component: Inspire_1, flip: false, columns: 50, rows: 20 },
      "2": { component: Inspire_1, flip: false, columns: 50, rows: 20 },
      "3": { component: Inspire_1, flip: false, columns: 50, rows: 20 },
      "4": { component: Inspire_1, flip: false, columns: 50, rows: 20 },
    };

    const patternConfig = seatPatternMap[data.id];
    if (patternConfig) {
      // 기본은 섹션 폴리곤의 fill 색상을 그대로 사용
      // (상단 useEffect에서 VIP 섹션은 보라색(#7C50E4)으로 강제하고 있음)
      let color = data.fill || "#FFCC10";
      // R, STANDING만 명시적으로 고정 색상 사용
      if (data.level === "R") {
        color = "#4CA0FF";
      } else if (data.level === "STANDING") {
        color = data.fill || "#FE4AB9"; // STANDING 좌석의 fill 색상 사용 (기본값: #FE4AB9)
      }
      setDetailViewColor(color);
      setSelectedPattern(() => patternConfig.component);
      setIsFlipped(patternConfig.flip);

      // 패턴 크기 계산 및 스케일 설정
      const cellSize = 12;
      const gap = 2;
      const { width, height } = calculatePatternSize(
        patternConfig.columns,
        patternConfig.rows,
        cellSize,
        gap
      );
      // 좌측 행 번호 레이블 폭(스케일 전 기준) 약간 여유를 더해 반영
      const rowLabelWidth = Math.max(16, Math.floor(cellSize * 1.5));
      const scale = calculateScale(width + rowLabelWidth, height);
      setPatternScale(scale);
      setSelectedMeta({
        level: data.level,
        id: data.id,
        columns: patternConfig.columns,
        rows: patternConfig.rows,
        cellSize,
        gap,
      });

      setShowDetailView(true);
    }
  };

  // 상세 좌석 호버용 핸들러 제거 (브라우저 기본 툴팁 사용)

  // 좌석 셀에 데이터 속성 부여 (row/seat/section/grade/active)
  useEffect(() => {
    if (!showDetailView || !patternWrapperRef.current || !selectedMeta) return;
    const gridEl = patternWrapperRef.current.querySelector("div.grid");
    if (!gridEl) return;
    const cells = Array.from(gridEl.children) as HTMLElement[];
    let currentRowIndex = -1;
    let seatNumberInRow = 0;
    const inactiveSeatNumbers: number[] = [];

    cells.forEach((el, index) => {
      const rowIndex = Math.floor(index / selectedMeta.columns);
      const colIndex = index % selectedMeta.columns;

      if (rowIndex !== currentRowIndex) {
        currentRowIndex = rowIndex;
        seatNumberInRow = 0; // 새 행 시작: 좌석 번호 초기화
      }

      const row = String(rowIndex + 1);
      el.setAttribute("row", row);
      el.setAttribute("col", String(colIndex + 1)); // 디버깅용 절대 열 번호
      el.setAttribute("section", selectedMeta.id);
      el.setAttribute("grade", selectedMeta.level);

      const bg = getComputedStyle(el).backgroundColor;
      const isTransparent = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
      if (isTransparent) {
        el.setAttribute("active", "0");
        el.removeAttribute("seat");
        el.removeAttribute("title");
        // 고유 번호 계산: (row - 1) * totalCols + col
        const seatNumber =
          (rowIndex + 1 - 1) * selectedMeta.columns + (colIndex + 1);
        inactiveSeatNumbers.push(seatNumber);
      } else {
        seatNumberInRow += 1;
        const seat = String(seatNumberInRow);
        el.setAttribute("active", "1");
        el.setAttribute("seat", seat);

        // 브라우저 기본 툴팁 설정
        const gradeLabel =
          selectedMeta.level === "STANDING"
            ? "스탠딩석"
            : `${selectedMeta.level}석`;
        el.setAttribute(
          "title",
          `[${gradeLabel}] ${selectedMeta.id}구역-${row}열-${seat}`
        );

        // 좌석 ID 생성 (section-row-seat 형식)
        const seatId = `${selectedMeta.id}-${row}-${seat}`;
        el.setAttribute("data-seat-id", seatId);

        // TAKEN 좌석 확인 (API 응답은 section-row-col 형식이므로 col로 매칭)
        const col = String(colIndex + 1);
        const takenSeatId = `${selectedMeta.id}-${row}-${col}`;
        const isTaken = takenSeats.has(takenSeatId);

        // 선택된 좌석인지 확인하고 색상 업데이트
        const isSelected = selectedIds.includes(seatId);
        if (isTaken) {
          // TAKEN 좌석: 회색 처리 및 클릭 불가
          el.style.backgroundColor = LIGHT_GRAY; // 회색
          el.style.cursor = "not-allowed";
          el.style.opacity = "0.6";
          el.setAttribute("data-taken", "true");
        } else if (readOnly) {
          // 읽기 전용 모드: 선택된 좌석만 색상 표시, 나머지는 회색
          if (isSelected) {
            el.style.backgroundColor = detailViewColor; // 원래 색상
            el.style.cursor = "default";
            el.style.opacity = "1";
          } else {
            el.style.backgroundColor = LIGHT_GRAY; // 회색
            el.style.cursor = "default";
            el.style.opacity = "0.5";
          }
          el.removeAttribute("data-taken");
        } else if (isSelected) {
          el.style.backgroundColor = "#4a4a4a"; // 선택된 좌석은 어두운 회색
          el.style.cursor = "pointer";
          el.style.opacity = "1";
          el.removeAttribute("data-taken");
        } else {
          el.style.backgroundColor = detailViewColor; // 원래 색상으로 복원
          el.style.cursor = "pointer";
          el.style.opacity = "1";
          el.removeAttribute("data-taken");
        }

        // 기존 클릭 핸들러 제거 후 새로 추가 (중복 방지)
        const existingClickHandler = (
          el as HTMLElement & { __clickHandler?: () => void }
        ).__clickHandler;
        if (existingClickHandler) {
          el.removeEventListener("click", existingClickHandler);
        }

        const clickHandler = () => {
          // TAKEN 좌석은 클릭 불가
          if (isTaken) {
            return;
          }
          if (onToggleSeat) {
            const gradeLabelForSeat =
              selectedMeta.level === "STANDING"
                ? "스탠딩석"
                : `${selectedMeta.level}석`;
            onToggleSeat({
              id: seatId,
              gradeLabel: gradeLabelForSeat,
              label: `${selectedMeta.id}구역-${row}열-${seat}`,
            });
          }
        };
        (el as HTMLElement & { __clickHandler?: () => void }).__clickHandler =
          clickHandler;
        el.addEventListener("click", clickHandler);
      }
    });

    // 현재 섹션이 사용하는 패턴과 같은 패턴을 flip: false로 사용하는 섹션 찾기
    const seatPatternMap: Record<
      string,
      {
        component: React.ComponentType<PatternComponentProps>;
        flip: boolean;
      }
    > = {
      "45": { component: Inspire_45, flip: false },
      "46": { component: Inspire_46, flip: false },
      "47": { component: Inspire_47, flip: false },
      "48": { component: Inspire_52, flip: true },
      "49": { component: Inspire_49, flip: false },
      "50": { component: Inspire_50, flip: false },
      "51": { component: Inspire_49, flip: true },
      "52": { component: Inspire_52, flip: false },
      "53": { component: Inspire_47, flip: true },
      "54": { component: Inspire_46, flip: true },
      "55": { component: Inspire_55, flip: false },
      "56": { component: Inspire_56, flip: false },
      "57": { component: Inspire_57, flip: false },
      "5": { component: Inspire_5, flip: false },
      "6": { component: Inspire_6, flip: false },
      "7": { component: Inspire_7, flip: false },
      "8": { component: Inspire_7, flip: false },
      "9": { component: Inspire_7, flip: false },
      "10": { component: Inspire_16, flip: true },
      "11": { component: Inspire_11, flip: false },
      "12": { component: Inspire_12, flip: false },
      "13": { component: Inspire_23, flip: false },
      "14": { component: Inspire_12, flip: true },
      "15": { component: Inspire_15, flip: false },
      "16": { component: Inspire_16, flip: false },
      "17": { component: Inspire_7, flip: false },
      "18": { component: Inspire_7, flip: false },
      "19": { component: Inspire_7, flip: false },
      "20": { component: Inspire_6, flip: true },
      "21": { component: Inspire_5, flip: false },
      "22": { component: Inspire_12, flip: false },
      "23": { component: Inspire_23, flip: false },
      "24": { component: Inspire_12, flip: true },
      "25": { component: Inspire_25, flip: false },
      "26": { component: Inspire_26, flip: false },
      "27": { component: Inspire_27, flip: false },
      "28": { component: Inspire_27, flip: false },
      "29": { component: Inspire_27, flip: false },
      "30": { component: Inspire_26, flip: true },
      "31": { component: Inspire_31, flip: false },
      "32": { component: Inspire_42, flip: false },
      "33": { component: Inspire_43, flip: false },
      "34": { component: Inspire_42, flip: true },
      "35": { component: Inspire_25, flip: true },
      "36": { component: Inspire_26, flip: false },
      "37": { component: Inspire_39, flip: false },
      "38": { component: Inspire_39, flip: false },
      "39": { component: Inspire_39, flip: false },
      "40": { component: Inspire_26, flip: true },
      "41": { component: Inspire_25, flip: false },
      "42": { component: Inspire_42, flip: false },
      "43": { component: Inspire_43, flip: false },
      "44": { component: Inspire_42, flip: true },
      "1": { component: Inspire_1, flip: false },
      "2": { component: Inspire_1, flip: false },
      "3": { component: Inspire_1, flip: false },
      "4": { component: Inspire_1, flip: false },
    };

    const currentPattern = seatPatternMap[selectedMeta.id];
    const currentIsFlipped = currentPattern?.flip || false;

    // 현재 섹션이 사용하는 패턴 컴포넌트와 같은 컴포넌트를 flip: false로 사용하는 섹션들
    const nonFlippedSectionsWithSamePattern: string[] = [];
    if (currentPattern) {
      Object.keys(seatPatternMap).forEach((id) => {
        const pattern = seatPatternMap[id];
        // 같은 컴포넌트이고 flip이 false인 섹션
        if (
          pattern.component === currentPattern.component &&
          pattern.flip === false
        ) {
          nonFlippedSectionsWithSamePattern.push(id);
        }
      });
      nonFlippedSectionsWithSamePattern.sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
    }

    // 섹션 정보 및 inactive 좌석 정보는 디버깅용 로그만 제거
  }, [
    showDetailView,
    selectedMeta,
    selectedIds,
    detailViewColor,
    onToggleSeat,
    takenSeats,
    readOnly,
  ]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {showDetailView ? (
        <div className="relative w-full h-full">
          <div className="w-full h-full flex justify-center items-center bg-neutral-100 overflow-hidden">
            {selectedPattern &&
              (() => {
                const PatternComponent = selectedPattern;
                return (
                  <div
                    className="flex justify-center items-center"
                    style={{
                      width: "100%",
                      height: "100%",
                    }}
                  >
                    <div
                      style={{
                        transform: `scale(${patternScale})`,
                        transformOrigin: "center center",
                      }}
                    >
                      <div
                        style={{ display: "flex", alignItems: "flex-start" }}
                      >
                        {/* 좌측 행 번호 레이블 */}
                        {selectedMeta && (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateRows: `repeat(${selectedMeta.rows}, ${selectedMeta.cellSize}px)`,
                              rowGap: `${selectedMeta.gap}px`,
                              marginRight: `${selectedMeta.gap}px`,
                              marginTop: 5,
                              minWidth: Math.max(
                                16,
                                Math.floor(selectedMeta.cellSize * 1.5)
                              ),
                            }}
                          >
                            {Array.from({ length: selectedMeta.rows }).map(
                              (_, r) => (
                                <div
                                  key={`row-label-${r}`}
                                  className="text-[10px] text-neutral-700"
                                  style={{
                                    height: selectedMeta.cellSize,
                                    lineHeight: `${selectedMeta.cellSize}px`,
                                    textAlign: "right",
                                    paddingRight: 4,
                                    userSelect: "none",
                                  }}
                                >
                                  {r + 1}
                                </div>
                              )
                            )}
                          </div>
                        )}

                        {/* 실제 패턴 그리드 */}
                        <div ref={patternWrapperRef}>
                          <PatternComponent
                            activeColor={detailViewColor}
                            flipHorizontal={isFlipped}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center p-4 w-full h-full">
          <div className="bg-white p-2 relative w-full h-full flex items-center justify-center">
            <svg
              viewBox="0 0 971 735"
              width="971"
              height="735"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-auto"
            >
              <defs>
                <pattern
                  id="pat_poly_0007"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#E8C94A" />
                  <rect width="4" height="8" fill="#372E16" />
                </pattern>
                <pattern
                  id="pat_poly_0010"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#66AAF1" />
                  <rect width="4" height="8" fill="#1A2A3C" />
                </pattern>
                <pattern
                  id="pat_poly_0017"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#86F46E" />
                  <rect width="4" height="8" fill="#223720" />
                </pattern>
                <pattern
                  id="pat_poly_0021"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#89F272" />
                  <rect width="4" height="8" fill="#253322" />
                </pattern>
                <pattern
                  id="pat_poly_0023"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#85F26A" />
                  <rect width="4" height="8" fill="#1F391C" />
                </pattern>
                <pattern
                  id="pat_poly_0024"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#63AAF2" />
                  <rect width="4" height="8" fill="#17273A" />
                </pattern>
                <pattern
                  id="pat_poly_0028"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#1E1E1E" />
                  <rect width="4" height="8" fill="#828282" />
                </pattern>
                <pattern
                  id="pat_poly_0031"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DC44A2" />
                  <rect width="4" height="8" fill="#E99ED0" />
                </pattern>
                <pattern
                  id="pat_poly_0032"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DD44A0" />
                  <rect width="4" height="8" fill="#E99ACF" />
                </pattern>
                <pattern
                  id="pat_poly_0033"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#505050" />
                  <rect width="4" height="8" fill="#DBDEDD" />
                </pattern>
                <pattern
                  id="pat_poly_0034"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DB3F9D" />
                  <rect width="4" height="8" fill="#E68CC5" />
                </pattern>
                <pattern
                  id="pat_poly_0035"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DD469D" />
                  <rect width="4" height="8" fill="#EAA1D0" />
                </pattern>
                <pattern
                  id="43"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#64ABF4" />
                  <rect width="4" height="8" fill="#192A3E" />
                </pattern>
                <pattern
                  id="pat_poly_0050"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DC47A3" />
                  <rect width="4" height="8" fill="#EAA2D5" />
                </pattern>
                <pattern
                  id="pat_poly_0051"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DC46A0" />
                  <rect width="4" height="8" fill="#E99FD3" />
                </pattern>
                <pattern
                  id="pat_poly_0052"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DD47A1" />
                  <rect width="4" height="8" fill="#E99CD4" />
                </pattern>
                <pattern
                  id="pat_poly_0053"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#DD44A0" />
                  <rect width="4" height="8" fill="#E8A1D4" />
                </pattern>
                <pattern
                  id="pat_poly_0055"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#83F36B" />
                  <rect width="4" height="8" fill="#1E361B" />
                </pattern>
                <pattern
                  id="pat_poly_0056"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#85F26A" />
                  <rect width="4" height="8" fill="#213D1E" />
                </pattern>
                <pattern
                  id="pat_poly_0057"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#87F270" />
                  <rect width="4" height="8" fill="#253724" />
                </pattern>
                <pattern
                  id="pat_poly_0061"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#85F36D" />
                  <rect width="4" height="8" fill="#23361F" />
                </pattern>
                <pattern
                  id="pat_poly_0065"
                  patternUnits="userSpaceOnUse"
                  width="8"
                  height="8"
                  patternTransform="rotate(45)"
                >
                  <rect width="8" height="8" fill="#E6C84B" />
                  <rect width="4" height="8" fill="#352D18" />
                </pattern>
              </defs>
              <polygon
                points="333,64 225,64 176,117 194,136 210,124 235,150 257,132 306,132 306,87 332,85"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="48"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.02560133490842872"
                data-color-group="0"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="279"
                y="98"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                48
              </text>
              <polygon
                points="344,64 344,132 404,132 404,86 425,84 426,64"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="49"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013830363433647599"
                data-color-group="1"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="385"
                y="98"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                49
              </text>
              <polygon
                points="441,63 441,132 528,132 527,64"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="50"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.017932551518744993"
                data-color-group="0"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="484"
                y="98"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                50
              </text>
              <polygon
                points="544,64 544,83 566,86 566,132 626,132 626,64"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="51"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013839415705994264"
                data-color-group="1"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="579"
                y="94"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                51
              </text>
              <polygon
                points="633,64 634,85 661,87 661,132 708,132 722,142 754,109 768,123 783,112 736,64"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="52"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.022190136945793484"
                data-color-group="1"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="686"
                y="105"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                52
              </text>
              <polygon
                points="790,120 746,169 799,218 842,168"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="53"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.015094664138065258"
                data-color-group="2"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="794"
                y="169"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                53
              </text>
              <polygon
                points="165,126 129,166 180,207 213,172"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="47"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.010731468866972332"
                data-color-group="3"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="172"
                y="168"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                47
              </text>
              <polygon
                points="443,142 443,195 529,195 528,141"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="28"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013907307748594257"
                data-color-group="4"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="486"
                y="168"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                28
              </text>
              <polygon
                points="540,142 540,195 623,194 622,141"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="29"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013519568749745406"
                data-color-group="5"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="581"
                y="168"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                29
              </text>
              <polygon
                points="634,141 634,195 681,195 703,141"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="30"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.009529025356923555"
                data-color-group="6"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="663"
                y="168"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                30
              </text>
              <polygon
                points="266,143 287,195 337,195 336,142"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="26"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.00971157951591465"
                data-color-group="7"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="307"
                y="169"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                26
              </text>
              <polygon
                points="347,143 348,195 432,195 431,142"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="27"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013588969504403177"
                data-color-group="7"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="390"
                y="169"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                27
              </text>
              <polygon
                points="257,150 154,250 204,270 277,203"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="25"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.019985908629380357"
                data-color-group="5"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="223"
                y="218"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                25
              </text>
              <polygon
                points="717,158 703,194 776,268 814,253"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="31"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.014112492588452015"
                data-color-group="4"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="753"
                y="218"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                31
              </text>
              <polygon
                points="121,175 71,223 70,334 137,334 137,250 154,230 129,205 140,191"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="46"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.029042707112219512"
                data-color-group="8"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="120"
                y="243"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                46
              </text>
              <polygon
                points="850,178 838,193 854,210 823,242 829,252 829,332 896,334 897,221"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="54"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.026711746982953064"
                data-color-group="8"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="852"
                y="245"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                54
              </text>
              <polygon
                points="292,206 309,247  314,260 325,288 336,291 337,206"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="6"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.00721466106029266"
                data-color-group="9"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="319"
                y="250"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                6
              </text>
              <polygon
                points="348,206 347,290 431,291 432,207"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="7"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.021794854386655745"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="390"
                y="249"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                7
              </text>
              <polygon
                points="442,207 442,290 529,290 528,206"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="8"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.022304799062184584"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="485"
                y="248"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                8
              </text>
              <polygon
                points="541,206 540,290 623,290 623,207"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="9"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.021278874862895793"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="582"
                y="248"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                9
              </text>
              <polygon
                points="674,206 633,207 633,238 635,291 652,260  663,233"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="10"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.006728855777688261"
                data-color-group="11"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="648"
                y="239"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                10
              </text>
              <polygon
                points="281,213 219,276 305,310 318,295"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="5"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.014359921365927548"
                data-color-group="12"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="281"
                y="274"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                5
              </text>
              <polygon
                points="762,272 721,234 678,302 689,305"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="11"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.008201358746079234"
                data-color-group="13"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="713"
                y="278"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                11
              </text>
              <polygon
                points="150,263 150,357 202,357 202,283"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="44"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013288735804905426"
                data-color-group="14"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="176"
                y="315"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                44
              </text>
              <polygon
                points="821,263 766,284 767,360 820,359"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="32"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.014471566058203093"
                data-color-group="5"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="793"
                y="316"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                32
              </text>
              <polygon
                points="216,289 217,358 300,357 299,321"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="24"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013498446780936518"
                data-color-group="12"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="258"
                y="331"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                24
              </text>
              <polygon
                points="753,291 667,324 667,359 752,360"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="12"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.013766997527220937"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="710"
                y="333"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                12
              </text>
              <polygon
                points="327,304 320,311 320,519 338,525 338,305"
                fill="#1A1A1A"
                fillOpacity="0.95"
                data-id="0"
                data-fill="#1A1A1A"
                data-seat-level="CONSOLE"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.011870546470594448"
                data-color-group="15"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <polygon
                points="349,401 357,401 453,304 350,304"
                fill="#FE4AB9"
                fillOpacity="0.95"
                data-id="1"
                data-fill="#FE4AB9"
                data-seat-level="STANDING"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.01678593035483399"
                data-color-group="16"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="377"
                y="353"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                1
              </text>
              <polygon
                points="486,304 555,377 615,377 614,304"
                fill="#FE4AB9"
                fillOpacity="0.95"
                data-id="2"
                data-fill="#FE4AB9"
                data-seat-level="STANDING"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.021376941146651337"
                data-color-group="17"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="550"
                y="340"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                2
              </text>
              <polygon
                points="464,326 376,417 467,505 526,446 516,430 593,430 593,400 515,400 526,385"
                fill="#4D4D4D"
                fillOpacity="0.95"
                data-id="0"
                data-fill="#4D4D4D"
                data-seat-level="STAGE"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.05268573376965286"
                data-color-group="20"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="464"
                y="415"
                fill="white"
                fontSize="24"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                STAGE
              </text>
              <polygon
                points="71,345 70,460 137,460 137,368 92,367 90,345"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="45"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.02018053248483367"
                data-color-group="23"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="101"
                y="391"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                45
              </text>
              <polygon
                points="873,344 871,367 829,368 829,470 871,471 873,495 896,496 897,344"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="55"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.024806243653979907"
                data-color-group="8"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="867"
                y="419"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                55
              </text>
              <polygon
                points="150,369 150,460 202,460 202,369"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="43"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.014278450914807556"
                data-color-group="24"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="176"
                y="414"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                43
              </text>
              <polygon
                points="300,369 216,369 216,460 300,460"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="23"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.023083294483997846"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="258"
                y="414"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                23
              </text>
              <polygon
                points="668,370 667,465 753,465 753,371"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="13"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.024890731529215455"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="710"
                y="418"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                13
              </text>
              <polygon
                points="767,370 766,465 820,465 820,371"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="33"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.015753971307314086"
                data-color-group="5"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="793"
                y="418"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                33
              </text>
              <polygon
                points="349,428 349,525 453,525 358,429"
                fill="#FE4AB9"
                fillOpacity="0.95"
                data-id="3"
                data-fill="#FE4AB9"
                data-seat-level="STANDING"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.016591306499380672"
                data-color-group="16"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="377"
                y="477"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                3
              </text>
              <polygon
                points="616,454 554,453 486,525 615,525"
                fill="#FE4AB9"
                fillOpacity="0.95"
                data-id="4"
                data-fill="#FE4AB9"
                data-seat-level="STANDING"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.02105860290246026"
                data-color-group="17"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="568"
                y="489"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                4
              </text>
              <polygon
                points="216,471 216,543 300,508 298,471"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="22"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.014003865320292026"
                data-color-group="12"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="258"
                y="498"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                22
              </text>
              <polygon
                points="202,472 150,472 150,571 202,550"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="42"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.01389976418830537"
                data-color-group="5"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="176"
                y="516"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                42
              </text>
              <polygon
                points="667,476 667,513 753,546 752,476"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="14"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.01410344031610535"
                data-color-group="12"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="710"
                y="503"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                14
              </text>
              <polygon
                points="767,476 766,553 820,574 820,476"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="34"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.014513809995820868"
                data-color-group="4"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="793"
                y="520"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                34
              </text>
              <polygon
                points="897,503 829,503 829,581 806,607 853,651 897,609"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="56"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.028657985537486216"
                data-color-group="8"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="852"
                y="576"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                56
              </text>
              <polygon
                points="306,520 221,558 272,609 312,532"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="21"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.01149185974409226"
                data-color-group="29"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="278"
                y="555"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                21
              </text>
              <polygon
                points="663,523 699,605 748,559"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="15"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.00913676022190137"
                data-color-group="30"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="703"
                y="562"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                15
              </text>
              <polygon
                points="337,541 326,541 312,572  305,588 290,625 337,625 337,596   337,579  337,571"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="20"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.008097257614092577"
                data-color-group="31"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="324"
                y="582"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                20
              </text>
              <polygon
                points="347,541 348,625 432,624 432,541"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="19"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.0215413907609491"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="390"
                y="583"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                19
              </text>
              <polygon
                points="442,542 442,624 529,624 529,541"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="18"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.022043791876189055"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="486"
                y="583"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                18
              </text>
              <polygon
                points="540,541 540,624 623,624 623,542"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="17"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.021042007069824703"
                data-color-group="10"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="582"
                y="583"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                17
              </text>
              <polygon
                points="634,541 633,624 674,625 660,590  651,570 639,542"
                fill="#68F237"
                fillOpacity="0.95"
                data-id="16"
                data-fill="#68F237"
                data-seat-level="VIP"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.00625059405537275"
                data-color-group="32"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="649"
                y="582"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                16
              </text>
              <polygon
                points="812,583 762,563 697,628 720,676"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="35"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.0172641920771495"
                data-color-group="5"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="748"
                y="613"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                35
              </text>
              <polygon
                points="156,587 247,680 271,628 207,568"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="41"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.017617230698669467"
                data-color-group="4"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="220"
                y="616"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                41
              </text>
              <polygon
                points="795,616 772,642 786,655  795,664 820,687 844,663 844,659 824,641"
                fill="#FFCC10"
                fillOpacity="0.95"
                data-id="57"
                data-fill="#FFCC10"
                data-seat-level="S"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.007744218992572611"
                data-color-group="33"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="810"
                y="653"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                57
              </text>
              <polygon
                points="285,635 254,705 337,705 337,636"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="40"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.014550019085207531"
                data-color-group="7"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="303"
                y="670"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                40
              </text>
              <polygon
                points="348,636 348,705 431,706 432,636"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="39"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.01794763863932277"
                data-color-group="4"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="390"
                y="671"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                39
              </text>
              <polygon
                points="443,636 443,705 529,705 529,636"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="38"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.018364043167269396"
                data-color-group="4"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="486"
                y="671"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                38
              </text>
              <polygon
                points="540,636 540,705 623,704 621,635"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="37"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.017703227285962794"
                data-color-group="4"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="581"
                y="670"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                37
              </text>
              <polygon
                points="634,636 634,705 671,705 704,685 680,636"
                fill="#4CA0FF"
                fillOpacity="0.95"
                data-id="36"
                data-fill="#4CA0FF"
                data-seat-level="R"
                data-capacity="None"
                data-component-count="None"
                data-ratio="0.012057626765758875"
                data-color-group="7"
                onClick={(e) => handlePolygonClick(e.currentTarget)}
                className="cursor-pointer"
              />
              <text
                x="665"
                y="673"
                fill="white"
                fontSize="16"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                pointerEvents="none"
              >
                36
              </text>
            </svg>
          </div>
        </div>
      )}

      {/* 커스텀 툴팁 제거 (브라우저 기본 툴팁 사용) */}
    </div>
  );
}
