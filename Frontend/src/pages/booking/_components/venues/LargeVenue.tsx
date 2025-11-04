import React, { useState, useRef } from "react";
import Inspire_45 from "../../../../shared/ui/common/Inspire/S/Inspire_45";
import Inspire_46 from "../../../../shared/ui/common/Inspire/S/Inspire_46";
import Inspire_47 from "../../../../shared/ui/common/Inspire/S/Inspire_47";
import Inspire_49 from "../../../../shared/ui/common/Inspire/S/Inspire_49";
import Inspire_50 from "../../../../shared/ui/common/Inspire/S/Inspire_50";
import Inspire_52 from "../../../../shared/ui/common/Inspire/S/Inspire_52";
import Inspire_55 from "../../../../shared/ui/common/Inspire/S/Inspire_55";
import Inspire_56 from "../../../../shared/ui/common/Inspire/S/Inspire_56";
import Inspire_57 from "../../../../shared/ui/common/Inspire/S/Inspire_57";
import Inspire_5 from "../../../../shared/ui/common/Inspire/VIP/Inspire_5";
import Inspire_6 from "../../../../shared/ui/common/Inspire/VIP/Inspire_6";
import Inspire_7 from "../../../../shared/ui/common/Inspire/VIP/Inspire_7";
import Inspire_11 from "../../../../shared/ui/common/Inspire/VIP/Inspire_11";
import Inspire_12 from "../../../../shared/ui/common/Inspire/VIP/Inspire_12";
import Inspire_15 from "../../../../shared/ui/common/Inspire/VIP/Inspire_15";
import Inspire_16 from "../../../../shared/ui/common/Inspire/VIP/Inspire_16";
import Inspire_23 from "../../../../shared/ui/common/Inspire/VIP/Inspire_23";
import Inspire_25 from "../../../../shared/ui/common/Inspire/R/Inspire_25";
import Inspire_26 from "../../../../shared/ui/common/Inspire/R/Inspire_26";
import Inspire_27 from "../../../../shared/ui/common/Inspire/R/Inspire_27";
import Inspire_31 from "../../../../shared/ui/common/Inspire/R/Inspire_31";
import Inspire_39 from "../../../../shared/ui/common/Inspire/R/Inspire_39";
import Inspire_42 from "../../../../shared/ui/common/Inspire/R/Inspire_42";
import Inspire_43 from "../../../../shared/ui/common/Inspire/R/Inspire_43";

interface PolygonData {
  id: string;
  level: string;
  group: string;
  capacity: string;
  components: string;
  ratio: string;
  fill: string;
}

// 그리드 배열 데이터 (10행 x 28열)
// O = 주황색, G = 회색 (원래는 주황색), W = 흰색/비어있음
// 두 번째 이미지 설명 기준으로 구성:
// - 왼쪽 그룹: 상단 5열 4행 주황색 20개, 아래 왼쪽 3열 2행 회색 6개
// - 중앙 그룹: 부채꼴 형태, 상단 5행은 각각 10개, 6번째 행은 8개 (중앙 그룹 내에서 5,8번째 위치가 빈 공간), 그 아래로 줄어듦
// - 오른쪽 그룹: 왼쪽과 대칭 (상단 5열 4행 주황색 20개, 아래 오른쪽 3열 2행 회색 6개)



export default function LargeVenue() {
  const [tooltip, setTooltip] = useState<{
    visible: boolean;
    x: number;
    y: number;
    text: string;
  }>({ visible: false, x: 0, y: 0, text: "" });
  const [showDetailView, setShowDetailView] = useState(false);
  const [detailViewColor, setDetailViewColor] = useState<string>("#FFCC10");
  const [isFlipped, setIsFlipped] = useState(false);
  const [selectedPattern, setSelectedPattern] = useState<React.ComponentType<{
    className?: string;
    cellSize?: number;
    gap?: number;
    activeColor?: string;
    backgroundColor?: string;
    flipHorizontal?: boolean;
  }> | null>(null);
  const [patternScale, setPatternScale] = useState<number>(1);
  const containerRef = useRef<HTMLDivElement>(null);

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
    containerHeight: number = 596  // 620 - 24 (padding)
  ) => {
    const scaleX = containerWidth / patternWidth;
    const scaleY = containerHeight / patternHeight;
    return Math.min(scaleX, scaleY, 1); // 1을 넘지 않도록
  };

  const handlePolygonMouseEnter = (
    e: React.MouseEvent<SVGPolygonElement>,
    polygon: SVGPolygonElement
  ) => {
    const lv = polygon.dataset.seatLevel || "";
    const id = polygon.dataset.id || "";
    const text = lv && id ? `${lv} • ${id}` : lv || id;

    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltip({
        visible: true,
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
        text,
      });
    }
  };

  const handlePolygonMouseLeave = () => {
    setTooltip({ visible: false, x: 0, y: 0, text: "" });
  };

  const handlePolygonClick = (polygon: SVGPolygonElement) => {
    const data: PolygonData = {
      id: polygon.dataset.id || "",
      level: polygon.dataset.seatLevel || "",
      group: polygon.dataset.colorGroup || "",
      capacity: polygon.dataset.capacity || "",
      components: polygon.dataset.componentCount || "",
      ratio: polygon.dataset.ratio || "",
      fill: polygon.dataset.fill || "",
    };
    console.log("[seat-click]", data);

    // 좌석별 패턴 매핑 (패턴 정보 포함)
    const seatPatternMap: Record<string, { 
      component: React.ComponentType<any>, 
      flip: boolean,
      columns: number,
      rows: number
    }> = {
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
    };

    const patternConfig = seatPatternMap[data.id];
    if (patternConfig) {
      // VIP 좌석인 경우 VIP 색상, R 좌석인 경우 R 색상, 그 외는 좌석의 fill 색상 사용
      let color = data.fill || "#FFCC10";
      if (data.level === "VIP") {
        color = "#68F237";
      } else if (data.level === "R") {
        color = "#4CA0FF";
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
      const scale = calculateScale(width, height);
      setPatternScale(scale);
      
      setShowDetailView(true);
    }
  };

  return (
    <div className="relative w-full h-full" ref={containerRef}>
      {showDetailView ? (
        <div className="relative w-full h-full">
          <div className="absolute top-2 right-2 z-10">
            <button
              onClick={() => setShowDetailView(false)}
              className="bg-purple-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-purple-600 transition-colors shadow-md"
            >
              전체 보기
            </button>
          </div>
          <div className="w-full h-full flex justify-center items-center bg-neutral-100 overflow-hidden">
            {selectedPattern && (() => {
              const PatternComponent = selectedPattern;
              return (
                <div 
                  className="flex justify-center items-center"
                  style={{
                    width: '100%',
                    height: '100%',
                  }}
                >
                  <div
                    style={{
                      transform: `scale(${patternScale})`,
                      transformOrigin: 'center center',
                    }}
                  >
                    <PatternComponent
                      activeColor={detailViewColor}
                      flipHorizontal={isFlipped}
                    />
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              data-seat-level="VIPR"
              data-capacity="None"
              data-component-count="None"
              data-ratio="0.021042007069824703"
              data-color-group="10"
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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
              onMouseEnter={(e) => handlePolygonMouseEnter(e, e.currentTarget)}
              onMouseLeave={handlePolygonMouseLeave}
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

      {/* Tooltip */}
      {tooltip.visible && (
        <div
          className="fixed pointer-events-none z-[9999] px-2 py-1.5 bg-black/75 text-white text-xs rounded-md shadow-lg"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`,
            transform: "translate(-50%, -140%)",
          }}
        >
          {tooltip.text}
        </div>
      )}

    </div>
  );
}
