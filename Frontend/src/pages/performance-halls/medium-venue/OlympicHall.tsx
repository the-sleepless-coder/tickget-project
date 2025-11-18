import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMatchStore } from "@features/booking-site/store";
import { useAuthStore } from "@features/auth/store";
import { getSectionSeatsStatus } from "@features/booking-site/api";

const LIGHT_GRAY = "#d4d4d8";
import Olympic_18 from "./seats-olympic-hall/S/Olympic_18";
import Olympic_20 from "./seats-olympic-hall/S/Olympic_20";
import Olympic_21 from "./seats-olympic-hall/S/Olympic_21";
import Olympic_22 from "./seats-olympic-hall/S/Olympic_22";
import Olympic_23 from "./seats-olympic-hall/S/Olympic_23";
import Olympic_1 from "./seats-olympic-hall/STANDING/Olympic_1";
import Olympic_4 from "./seats-olympic-hall/VIP/Olympic_4";
import Olympic_5 from "./seats-olympic-hall/VIP/Olympic_5";
import Olympic_7 from "./seats-olympic-hall/R/Olympic_7";
import Olympic_9 from "./seats-olympic-hall/R/Olympic_9";
import Olympic_11 from "./seats-olympic-hall/R/Olympic_11";
import Olympic_12 from "./seats-olympic-hall/R/Olympic_12";

export interface MediumVenueRef {
  backToOverview: () => void;
  refreshSeatStatus: (sectionId: string, takenSeatIds: string[]) => void;
}

type MediumVenueSeat = {
  id: string;
  gradeLabel: string;
  label: string;
  price?: number;
};

export default function MediumVenue({
  onBackToOverview,
  selectedIds = [],
  onToggleSeat,
  readOnly = false, // 읽기 전용 모드: 선택된 좌석만 색상 표시, 나머지는 회색
}: {
  onBackToOverview?: React.MutableRefObject<MediumVenueRef | null>;
  selectedIds?: string[];
  onToggleSeat?: (seat: MediumVenueSeat) => void;
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
          console.log(
            `[refresh-seat-status] 섹션 ${sectionId} TAKEN/MY_RESERVED 좌석 업데이트:`,
            takenSeatIds
          );
        },
      };
    }
    return () => {
      if (onBackToOverview) {
        onBackToOverview.current = null;
      }
    };
  }, [onBackToOverview]);
  const rootRef = useRef<HTMLDivElement>(null);
  const patternWrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailViewColor, setDetailViewColor] = useState<string>("#FFCC10");
  type PatternComponentProps = {
    className?: string;
    cellSize?: number;
    gap?: number;
    activeColor?: string;
    backgroundColor?: string;
    flipHorizontal?: boolean;
  };
  const [SelectedPattern, setSelectedPattern] =
    useState<React.ComponentType<PatternComponentProps> | null>(null);
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState<{
    level: string;
    id: string;
    columns: number;
    rows: number;
    cellSize: number;
    gap: number;
  } | null>(null);
  const [emptyRows, setEmptyRows] = useState<boolean[]>([]);
  const [searchParams] = useSearchParams();
  const matchIdFromStore = useMatchStore((s) => s.matchId);
  const currentUserId = useAuthStore((s) => s.userId);
  // TAKEN 좌석 정보 저장 (section-row-col 형식의 seatId를 Set으로 저장)
  const [takenSeats, setTakenSeats] = useState<Set<string>>(new Set());

  useEffect(() => {
    // interactive tooltip/hover/click removed

    // normalize polygon colors and remove outlines per level spec
    const normalizePolygons = () => {
      const svg = rootRef.current?.querySelector("svg");
      if (!svg) return;
      const polygons = Array.from(
        svg.querySelectorAll("polygon")
      ) as SVGPolygonElement[];

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

      polygons.forEach((p) => {
        const level = p.getAttribute("data-seat-level") || "";
        const idAttr = p.getAttribute("data-id") || "";
        let fill: string | null = null;

        // readOnly 모드이고 사용자가 선택한 좌석이 없는 섹션은 회색 처리
        if (readOnly && idAttr !== "0" && sectionsWithSeats.size > 0) {
          if (!sectionsWithSeats.has(idAttr)) {
            fill = LIGHT_GRAY; // 회색
          } else {
            // 원래 색상 유지
            if (level === "STANDING") fill = "#FE4AB9";
            else if (level === "VIP") fill = "#7C50E4";
            else if (level === "R") fill = "#4CA0FF";
            else if (level === "S") fill = "#FFCC10";
          }
        } else {
          // 일반 모드: 원래 색상
          if (level === "STANDING") fill = "#FE4AB9";
          else if (level === "VIP") fill = "#7C50E4";
          else if (level === "R") fill = "#4CA0FF";
          else if (level === "S") fill = "#FFCC10";
        }

        // id=0 areas (e.g., STAGE/CONSOLE) should be black
        if (idAttr === "0") fill = "#949494";

        if (fill) {
          p.setAttribute("fill", fill);
          p.setAttribute("data-fill", fill);
          const existingStyle = p.getAttribute("style") || "";
          const styleWithoutFill = existingStyle
            .split(";")
            .filter((s) => s.trim() && !s.trim().startsWith("fill:"))
            .join(";");
          const nextStyle = `fill:${fill};${styleWithoutFill}`;
          p.setAttribute("style", nextStyle);
        }
        p.removeAttribute("stroke");
        p.removeAttribute("stroke-opacity");
        p.removeAttribute("stroke-width");

        // 브라우저 기본 툴팁 설정 (전체 뷰)
        if (idAttr && idAttr !== "0" && level) {
          const gradeLabel = level === "STANDING" ? "스탠딩석" : `${level}석`;
          p.setAttribute("title", `[${gradeLabel}] ${idAttr}구역`);
        }
      });
    };

    // tighten viewBox to the union of all polygons so they fill the svg
    const fitSvgToPolygons = () => {
      const svg = rootRef.current?.querySelector("svg");
      if (!svg) return;
      const polygons = Array.from(
        svg.querySelectorAll("polygon")
      ) as SVGPolygonElement[];
      if (polygons.length === 0) return;
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
      });
      if (
        !isFinite(minX) ||
        !isFinite(minY) ||
        !isFinite(maxX) ||
        !isFinite(maxY)
      )
        return;
      const padding = 8; // small breathing room
      const vbX = minX - padding;
      const vbY = minY - padding;
      const vbW = Math.max(1, maxX - minX + padding * 2);
      const vbH = Math.max(1, maxY - minY + padding * 2);
      svg.setAttribute("viewBox", `${vbX} ${vbY} ${vbW} ${vbH}`);
    };

    // add centered numeric labels to polygons (except id=0) and keep them persistent
    const applyLabels = () => {
      const svg = rootRef.current?.querySelector("svg");
      if (!svg) return;
      // ensure polygons are normalized before labeling
      normalizePolygons();
      // adjust viewBox so polygons occupy the full svg area
      fitSvgToPolygons();
      // remove previous dedicated layer if exists
      const prevLayer = svg.querySelector('g[data-seat-label-layer="1"]');
      if (prevLayer && prevLayer.parentNode)
        prevLayer.parentNode.removeChild(prevLayer);
      const layer = document.createElementNS("http://www.w3.org/2000/svg", "g");
      layer.setAttribute("data-seat-label-layer", "1");
      layer.setAttribute("pointer-events", "none");
      const polygons = Array.from(
        svg.querySelectorAll("polygon")
      ) as SVGPolygonElement[];
      polygons.forEach((p) => {
        const id = p.getAttribute("data-id") || "";
        const level = p.getAttribute("data-seat-level") || "";
        const bbox = p.getBBox();
        const cx = bbox.x + bbox.width / 2;
        const cy = bbox.y + bbox.height / 2;
        // STAGE (id=0 & seat-level=STAGE) → show label "STAGE"
        if (id === "0" && level === "STAGE") {
          const t = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          const stageYOffset = 90;
          t.setAttribute("x", String(cx));
          t.setAttribute("y", String(cy - stageYOffset));
          t.setAttribute("text-anchor", "middle");
          t.setAttribute("dominant-baseline", "middle");
          t.setAttribute("data-seat-label", "1");
          t.setAttribute("fill", "#ffffff");
          t.setAttribute("font-size", "20");
          t.setAttribute("font-weight", "bold");
          t.setAttribute(
            "style",
            [
              "pointer-events:none",
              "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial",
            ].join(";")
          );
          t.textContent = "STAGE";
          layer.appendChild(t);
          return;
        }
        // Regular numeric ids (except 0)
        if (/^\d+$/.test(id) && id !== "0") {
          const text = document.createElementNS(
            "http://www.w3.org/2000/svg",
            "text"
          );
          text.setAttribute("x", String(cx));
          text.setAttribute("y", String(cy));
          text.setAttribute("text-anchor", "middle");
          text.setAttribute("dominant-baseline", "middle");
          text.setAttribute("data-seat-label", "1");
          // set as element attributes to avoid CSS overrides
          text.setAttribute("fill", "#ffffff");
          text.setAttribute("font-size", "16");
          text.setAttribute("font-weight", "bold");
          text.setAttribute(
            "style",
            [
              "pointer-events:none",
              "font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial",
            ].join(";")
          );
          text.textContent = id;
          layer.appendChild(text);
        }
      });
      svg.appendChild(layer);
    };

    if (showDetailView) return;

    // initial normalize + label draw
    applyLabels();

    // Observe DOM changes to re-apply labels if the SVG subtree gets replaced
    const observer = new MutationObserver(() => {
      // avoid infinite loops by disconnecting during re-apply
      observer.disconnect();
      requestAnimationFrame(() => {
        applyLabels();
        if (rootRef.current) {
          observer.observe(rootRef.current, { childList: true, subtree: true });
        }
      });
    });
    if (rootRef.current) {
      observer.observe(rootRef.current, { childList: true, subtree: true });
    }

    // Click delegation to open inline detail view for supported blocks
    const handleClick = async (e: MouseEvent) => {
      // readOnly 모드일 때는 클릭 이벤트 무시
      if (readOnly) return;

      const target = e.target as Element | null;
      if (!target) return;
      const polygon = (target as Element).closest?.("polygon");
      if (!polygon) return;
      const id = (polygon as Element).getAttribute("data-id");
      if (
        id &&
        [
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
          "8",
          "9",
          "10",
          "11",
          "12",
          "13",
          "14",
          "15",
          "16",
          "17",
          "18",
          "19",
          "20",
          "21",
          "22",
          "23",
          "24",
          "25",
          "26",
          "27",
          "28",
        ].includes(id)
      ) {
        // 섹션 ID로 API 호출
        const sectionId = id;
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
              console.log(
                `[section-click] API 호출: matchId=${matchId}, sectionId=${sectionId}, userId=${currentUserId}`
              );
              const response = await getSectionSeatsStatus(
                matchId,
                sectionId,
                currentUserId
              );
              console.log("[section-click] API 응답:", response);

              // TAKEN 또는 MY_RESERVED 상태인 좌석들을 Set에 저장 (section-row-col 형식)
              // MY_RESERVED는 다른 사용자가 예약한 좌석이므로 선택할 수 없음
              if (response.seats && response.seats.length > 0) {
                const taken = new Set<string>();
                // API 응답의 seatId 형식 확인을 위한 샘플 로그
                if (response.seats.length > 0) {
                  console.log(
                    "[section-click] API 응답 seatId 샘플:",
                    response.seats[0].seatId,
                    "전체 좌석 수:",
                    response.seats.length
                  );
                }
                response.seats.forEach((seat) => {
                  if (
                    seat.status === "TAKEN" ||
                    seat.status === "MY_RESERVED"
                  ) {
                    taken.add(seat.seatId);
                  }
                });
                setTakenSeats((prev) => {
                  const merged = new Set(prev);
                  taken.forEach((id) => merged.add(id));
                  return merged;
                });
                console.log(
                  "[section-click] TAKEN 좌석 저장:",
                  Array.from(taken),
                  `(총 ${taken.size}개)`
                );
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

        const level =
          (polygon as Element).getAttribute("data-seat-level") || "";
        // match overview colors used in MediumVenue normalization
        let color = "#FFCC10"; // S default
        if (level === "STANDING") color = "#FE4AB9";
        else if (level === "VIP") color = "#7C50E4";
        else if (level === "R") color = "#4CA0FF";
        else if (level === "S") color = "#FFCC10";
        setDetailViewColor(color);

        // pattern mapping
        if (["18", "19", "27", "28"].includes(id)) {
          setSelectedPattern(() => Olympic_18);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 12,
            rows: 10,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "20") {
          setSelectedPattern(() => Olympic_20);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 14,
            rows: 9,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "26") {
          setSelectedPattern(() => Olympic_20);
          setIsFlipped(true);
          setSelectedMeta({
            level,
            id,
            columns: 14,
            rows: 9,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "21") {
          setSelectedPattern(() => Olympic_21);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 4,
            rows: 5,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "25") {
          setSelectedPattern(() => Olympic_21);
          setIsFlipped(true);
          setSelectedMeta({
            level,
            id,
            columns: 4,
            rows: 5,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "22") {
          setSelectedPattern(() => Olympic_22);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 16,
            rows: 7,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "24") {
          setSelectedPattern(() => Olympic_22);
          setIsFlipped(true);
          setSelectedMeta({
            level,
            id,
            columns: 16,
            rows: 7,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "23") {
          setSelectedPattern(() => Olympic_23);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 18,
            rows: 6,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "1" || id === "2" || id === "3") {
          setSelectedPattern(() => Olympic_1);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 50,
            rows: 10,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "4" || id === "6") {
          setSelectedPattern(() => Olympic_4);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 9,
            rows: 9,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "5") {
          setSelectedPattern(() => Olympic_5);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 22,
            rows: 9,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "7" || id === "8") {
          setSelectedPattern(() => Olympic_7);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 24,
            rows: 12,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "17" || id === "16") {
          setSelectedPattern(() => Olympic_7);
          setIsFlipped(true);
          setSelectedMeta({
            level,
            id,
            columns: 24,
            rows: 12,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "9" || id === "10") {
          setSelectedPattern(() => Olympic_9);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 24,
            rows: 9,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "14" || id === "15") {
          setSelectedPattern(() => Olympic_9);
          setIsFlipped(true);
          setSelectedMeta({
            level,
            id,
            columns: 24,
            rows: 9,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "11") {
          setSelectedPattern(() => Olympic_11);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 16,
            rows: 5,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "13") {
          setSelectedPattern(() => Olympic_11);
          setIsFlipped(true);
          setSelectedMeta({
            level,
            id,
            columns: 16,
            rows: 5,
            cellSize: 12,
            gap: 2,
          });
        } else if (id === "12") {
          setSelectedPattern(() => Olympic_12);
          setIsFlipped(false);
          setSelectedMeta({
            level,
            id,
            columns: 18,
            rows: 5,
            cellSize: 12,
            gap: 2,
          });
        }
        setShowDetailView(true);
      }
    };
    const root = rootRef.current;
    root?.addEventListener("click", handleClick);

    return () => {
      observer.disconnect();
      root?.removeEventListener("click", handleClick);
    };
  }, [
    showDetailView,
    searchParams,
    matchIdFromStore,
    currentUserId,
    readOnly,
    selectedIds,
  ]);

  const content = `
<div class='wrapper'>
  <div class='card'>
    <svg viewBox="0 0 1164 1076" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id='pat_poly_0003' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060606'/><rect width='4' height='8' fill='#CECECE'/></pattern>
        <pattern id='pat_poly_0004' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#000000'/><rect width='4' height='8' fill='#B3B3B3'/></pattern>
        <pattern id='pat_poly_0005' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060606'/><rect width='4' height='8' fill='#626262'/></pattern>
        <pattern id='pat_poly_0006' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060707'/><rect width='4' height='8' fill='#A2A6A7'/></pattern>
        <pattern id='pat_poly_0007' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#030303'/><rect width='4' height='8' fill='#ACACAC'/></pattern>
        <pattern id='pat_poly_0008' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#020202'/><rect width='4' height='8' fill='#D7D7D7'/></pattern>
        <pattern id='pat_poly_0009' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#000000'/><rect width='4' height='8' fill='#B9B9B9'/></pattern>
        <pattern id='pat_poly_0010' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060606'/><rect width='4' height='8' fill='#CECECE'/></pattern>
        <pattern id='pat_poly_0011' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#060707'/><rect width='4' height='8' fill='#A2A6A7'/></pattern>
        <pattern id='pat_poly_0013' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#0C0D0F'/><rect width='4' height='8' fill='#D3D3D5'/></pattern>
        <pattern id='pat_poly_0014' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#0C0D0F'/><rect width='4' height='8' fill='#CFD0D2'/></pattern>
        <pattern id='pat_poly_0016' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#111214'/><rect width='4' height='8' fill='#E1E1E1'/></pattern>
        <pattern id='pat_poly_0017' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#0E0F10'/><rect width='4' height='8' fill='#D1D1D1'/></pattern>
        
        <pattern id='pat_poly_0045' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#1A1D68'/><rect width='4' height='8' fill='#9292B6'/></pattern>
        <pattern id='pat_poly_0048' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#6C69BB'/><rect width='4' height='8' fill='#AFAFDB'/></pattern>
        <pattern id='pat_poly_0049' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#6C69BB'/><rect width='4' height='8' fill='#B1AFDB'/></pattern>
        <pattern id='pat_poly_0060' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#181D67'/><rect width='4' height='8' fill='#7A7CA7'/></pattern>
        <pattern id='pat_poly_0074' patternUnits='userSpaceOnUse' width='8' height='8' patternTransform='rotate(45)'><rect width='8' height='8' fill='#1D1D66'/><rect width='4' height='8' fill='#7477A5'/></pattern>
       
       
      </defs>
      <polygon points="418,158 418,205 566,206 566,331 505,332 505,389 654,389 654,332 592,331 592,206 739,205 739,158" fill="#BCBBC3" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="0" data-fill="#BCBBC3" data-seat-level="STAGE" data-capacity="None" data-component-count="None" data-ratio="0.0791309837949847" data-color-group="10"></polygon>

      <polygon points="422,229 422,314 550,314 550,229" fill="#6C69BB" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="1" data-fill="#6C69BB" data-seat-level="STANDING" data-capacity="None" data-component-count="None" data-ratio="0.03202444218454968" data-color-group="17"></polygon>
      <polygon points="606,229 606,314 734,314 734,229" fill="#6C69BB" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="2" data-fill="#6C69BB" data-seat-level="STANDING" data-capacity="None" data-component-count="None" data-ratio="0.03202444218454968" data-color-group="17"></polygon>
     
      
      <polygon points="351,309 281,378 281,468 297,487 390,397 390,350" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="7" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.03635127398705777" data-color-group="26"></polygon>
      <polygon points="811,309 773,349 772,396 865,487 881,469 881,376" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="17" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.03648814315632078" data-color-group="26"></polygon>
      <polygon points="128,324 128,422 234,422 234,324" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="18" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.004903742709509169" data-color-group="26"></polygon>
      
      <polygon points="926,324 926,422 1032,422 1032,324" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="28" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02278798082654261" data-color-group="26"></polygon>
      
      <polygon points="434,407 435,469 723,469 723,406" fill="#6C69BB" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="3" data-fill="#6C69BB" data-seat-level="STANDING" data-capacity="None" data-component-count="None" data-ratio="0.05358795904521245" data-color-group="17"></polygon>
      
      <polygon points="373,437 312,501 388,573 390,451" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="8" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.018059371785230198" data-color-group="26"></polygon>
      <polygon points="790,437 772,453 775,573 850,502" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="16" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.018227146895939694" data-color-group="26"></polygon>
      <polygon points="128,439 128,537 234,537 234,439" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="19" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.004903742709509169" data-color-group="26"></polygon>
      
      <polygon points="926,439 926,537 1032,537 1032,439" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="27" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02278650911504516" data-color-group="26"></polygon>
      
      
      <polygon points="424,486 424,525 734,525 734,486" fill="#BCBBC3" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="0" data-fill="#BCBBC3" data-seat-level="CONSOLE" data-capacity="None" data-component-count="None" data-ratio="0.03558598400838287" data-color-group="10"></polygon>
      
      <polygon points="286,504 281,512 281,625 299,642 361,575" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="9" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.01906455073798973" data-color-group="26"></polygon>
      <polygon points="877,504 801,576 864,642 881,626" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="15" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.01869809457512425" data-color-group="26"></polygon>
      <polygon points="431,544 431,697 489,698 490,545" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="4" data-fill="#1B1D65" data-seat-level="VIP" data-capacity="None" data-component-count="None" data-ratio="0.02673952619720051" data-color-group="26"></polygon>
      <polygon points="508,544 507,697 650,697 650,545" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="5" data-fill="#1B1D65" data-seat-level="VIP" data-capacity="None" data-component-count="None" data-ratio="0.06480828750178445" data-color-group="26"></polygon>
      <polygon points="667,544 666,696 725,698 726,544" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="6" data-fill="#1B1D65" data-seat-level="VIP" data-capacity="None" data-component-count="None" data-ratio="0.02718986991542074" data-color-group="26"></polygon>
      <polygon points="128,554 128,671 234,671 234,554" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="20" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.005854468336862988" data-color-group="26"></polygon>
      
      <polygon points="926,554 926,670 1032,670 1032,555" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="26" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.027198700184405452" data-color-group="26"></polygon>
      
      
      <polygon points="377,591 290,674 349,733 390,697 390,606" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="10" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.02484101836548778" data-color-group="26"></polygon>
      <polygon points="786,591 772,607 772,696 813,733 872,673" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="14" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.024832188096503068" data-color-group="26"></polygon>
      
      
      <polygon points="971,612 971,614 973,614 973,612" fill="#54558D" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="poly_0080" data-fill="#54558D" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="1.1773691979613852e-05" data-color-group="43"></polygon>
      
      <polygon points="364,758 391,788 490,788 490,723 421,722 409,713" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="11" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.021813707815229566" data-color-group="26"></polygon>
      <polygon points="794,758 749,713 737,722 668,722 668,788 767,788" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="13" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.021815179526727017" data-color-group="26"></polygon>
      <polygon points="507,723 507,788 650,788 650,722" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="12" data-fill="#1B1D65" data-seat-level="R" data-capacity="None" data-component-count="None" data-ratio="0.02777855451440143" data-color-group="26"></polygon>
      <polygon points="342,794 302,871 325,885 363,811" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="21" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.007379161448222982" data-color-group="26"></polygon>
      <polygon points="815,794 795,812 829,884 833,885 854,875 855,870 820,797" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="25" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.007374746313730627" data-color-group="26"></polygon>
      <polygon points="351,889 487,893 488,815 378,814" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="22" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02890441380995201" data-color-group="26"></polygon>
      <polygon points="507,816 508,895 650,894 649,815" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="23" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.03366687221570581" data-color-group="26"></polygon>
      <polygon points="669,815 670,893 805,893 779,814" fill="#1B1D65" fill-opacity="0.95" stroke="#222" stroke-opacity="0.55" stroke-width="1" data-id="24" data-fill="#1B1D65" data-seat-level="S" data-capacity="None" data-component-count="None" data-ratio="0.02888086642599278" data-color-group="26"></polygon>
     
    </svg>
  </div>
</div>
`;

  // calculate scale similar to LargeVenue
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

  const calculateScale = (
    patternWidth: number,
    patternHeight: number,
    containerWidth: number = 616,
    containerHeight: number = 596
  ) => {
    const scaleX = containerWidth / patternWidth;
    const scaleY = containerHeight / patternHeight;
    return Math.min(scaleX, scaleY, 1);
  };

  let patternScale = 1;
  if (showDetailView && selectedMeta) {
    const { width, height } = calculatePatternSize(
      selectedMeta.columns,
      selectedMeta.rows,
      selectedMeta.cellSize,
      selectedMeta.gap
    );
    const rowLabelWidth = Math.max(16, Math.floor(selectedMeta.cellSize * 1.5));
    patternScale = calculateScale(width + rowLabelWidth, height);
  }

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
        el.setAttribute("seatid", seatId);

        // TAKEN 좌석 확인 (API 응답은 section-row-col 형식이므로 col로 매칭)
        const col = String(colIndex + 1);
        const takenSeatId = `${selectedMeta.id}-${row}-${col}`;
        const isTaken = takenSeats.has(takenSeatId);

        // 디버깅: 첫 번째 좌석에서만 매칭 확인 로그 출력
        if (index === 0 || (isTaken && !el.hasAttribute("data-debug-logged"))) {
          console.log("[seat-match] 좌석 ID 매칭 확인:", {
            seatId: seatId,
            takenSeatId,
            isTaken,
            takenSeatsSample: Array.from(takenSeats).slice(0, 5),
            section: selectedMeta.id,
            row,
            col,
          });
          el.setAttribute("data-debug-logged", "true");
        }

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
            console.log(
              "[seat-click] TAKEN 좌석은 선택할 수 없습니다:",
              takenSeatId
            );
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
    const patternToSectionsMap: Record<
      string,
      { sections: string[]; flippedSections: string[] }
    > = {
      Olympic_18: { sections: ["18", "19", "27", "28"], flippedSections: [] },
      Olympic_20: { sections: ["20"], flippedSections: ["26"] },
      Olympic_21: { sections: ["21"], flippedSections: ["25"] },
      Olympic_22: { sections: ["22"], flippedSections: ["24"] },
      Olympic_23: { sections: ["23"], flippedSections: [] },
      Olympic_1: { sections: ["1", "2", "3"], flippedSections: [] },
      Olympic_4: { sections: ["4", "6"], flippedSections: [] },
      Olympic_5: { sections: ["5"], flippedSections: [] },
      Olympic_7: { sections: ["7", "8"], flippedSections: ["16", "17"] },
      Olympic_9: { sections: ["9", "10"], flippedSections: ["14", "15"] },
      Olympic_11: { sections: ["11"], flippedSections: ["13"] },
      Olympic_12: { sections: ["12"], flippedSections: [] },
    };

    // 현재 섹션이 사용하는 패턴 찾기
    let currentPatternName: string | null = null;
    for (const [patternName, mapping] of Object.entries(patternToSectionsMap)) {
      if (
        mapping.sections.includes(selectedMeta.id) ||
        mapping.flippedSections.includes(selectedMeta.id)
      ) {
        currentPatternName = patternName;
        break;
      }
    }

    const currentIsFlipped = isFlipped;

    // 같은 패턴을 flip: false로 사용하는 섹션들
    const nonFlippedSectionsWithSamePattern: string[] = [];
    if (currentPatternName && patternToSectionsMap[currentPatternName]) {
      nonFlippedSectionsWithSamePattern.push(
        ...patternToSectionsMap[currentPatternName].sections
      );
      nonFlippedSectionsWithSamePattern.sort(
        (a, b) => parseInt(a) - parseInt(b)
      );
    }

    // 섹션 정보 및 active가 0인 좌석 정보 출력
    console.log({
      section: selectedMeta.id,
      grade: selectedMeta.level,
      totalRows: selectedMeta.rows,
      totalCols: selectedMeta.columns,
      isFlipped: currentIsFlipped,
      inactiveSeatsCount: inactiveSeatNumbers.length,
      inactiveSeatNumbers: inactiveSeatNumbers,
      nonFlippedSectionsWithSamePattern: nonFlippedSectionsWithSamePattern,
    });
    // 값만 쉼표로 구분된 문자열로 출력 (복사용)
    console.log("inactiveSeatNumbers:", inactiveSeatNumbers.join(", "));
    console.log(
      "nonFlippedSectionsWithSamePattern:",
      nonFlippedSectionsWithSamePattern.join(", ")
    );
  }, [
    showDetailView,
    SelectedPattern,
    selectedMeta,
    isFlipped,
    selectedIds,
    detailViewColor,
    onToggleSeat,
    takenSeats,
    readOnly,
  ]);

  // Analyze grid after render to determine fully empty rows
  useEffect(() => {
    if (!showDetailView || !patternWrapperRef.current || !selectedMeta) return;
    const gridEl = patternWrapperRef.current.querySelector("div.grid");
    if (!gridEl) return;
    const cells = Array.from(gridEl.children) as HTMLElement[];
    if (cells.length === 0) return;
    const nextEmptyRows: boolean[] = new Array(selectedMeta.rows).fill(true);
    cells.forEach((el, index) => {
      const rowIndex = Math.floor(index / selectedMeta.columns);
      const bg = getComputedStyle(el).backgroundColor;
      const isTransparent = bg === "rgba(0, 0, 0, 0)" || bg === "transparent";
      if (!isTransparent) {
        nextEmptyRows[rowIndex] = false;
      }
    });
    setEmptyRows(nextEmptyRows);
  }, [
    showDetailView,
    selectedMeta,
    selectedIds,
    detailViewColor,
    onToggleSeat,
    takenSeats,
  ]);

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {showDetailView ? (
        <div className="relative w-full h-full">
          <div className="w-full h-full flex justify-center items-center bg-neutral-100 overflow-hidden">
            <div
              className="flex justify-center items-center"
              style={{ width: "100%", height: "100%" }}
            >
              <div
                style={{
                  transform: `scale(${patternScale})`,
                  transformOrigin: "center center",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start" }}>
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
                      {(() => {
                        let visibleRowNum = 0;
                        return Array.from({ length: selectedMeta.rows }).map(
                          (_, r) => {
                            const isEmpty = emptyRows[r] === true;
                            const label = isEmpty
                              ? ""
                              : String(++visibleRowNum);
                            return (
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
                                {label}
                              </div>
                            );
                          }
                        );
                      })()}
                    </div>
                  )}
                  <div>
                    <div ref={patternWrapperRef}>
                      {SelectedPattern && (
                        <SelectedPattern
                          activeColor={detailViewColor}
                          flipHorizontal={isFlipped}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div ref={rootRef}>
          <style>{`
        .wrapper{display:flex;align-items:center;justify-content:center;padding:16px}
        .card{background:#fff;padding:8px;position:relative;max-width:1100px;width:100%}
        svg{width:100%;height:auto;display:block}
        svg polygon[data-id="1"],
        svg polygon[data-id="2"],
        svg polygon[data-id="3"],
        svg polygon[data-id="4"],
        svg polygon[data-id="5"],
        svg polygon[data-id="6"],
        svg polygon[data-id="7"],
        svg polygon[data-id="8"],
        svg polygon[data-id="9"],
        svg polygon[data-id="10"],
        svg polygon[data-id="11"],
        svg polygon[data-id="12"],
        svg polygon[data-id="13"],
        svg polygon[data-id="14"],
        svg polygon[data-id="15"],
        svg polygon[data-id="16"],
        svg polygon[data-id="17"],
        svg polygon[data-id="18"],
        svg polygon[data-id="19"],
        svg polygon[data-id="20"],
        svg polygon[data-id="21"],
        svg polygon[data-id="22"],
        svg polygon[data-id="23"],
        svg polygon[data-id="24"],
        svg polygon[data-id="25"],
        svg polygon[data-id="26"],
        svg polygon[data-id="27"],
        svg polygon[data-id="28"]{cursor:pointer}
      `}</style>
          <div dangerouslySetInnerHTML={{ __html: content }} />
        </div>
      )}

      {/* 커스텀 툴팁 제거 (브라우저 기본 툴팁 사용) */}
    </div>
  );
}
