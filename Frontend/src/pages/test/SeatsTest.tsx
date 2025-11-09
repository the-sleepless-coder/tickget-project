import { useMemo, useState, useEffect, useRef } from "react";
import { Button } from "../../shared/ui/base/Button";

export default function SeatsTestPage() {
  const [mode, setMode] = useState<"none" | "svg" | "html">("none");
  const COLS = 100;
  const ROWS = 500;
  const SIZE = 14; // px
  const GAP = 2; // px
  const renderStartRef = useRef<number | null>(null);
  const [renderMs, setRenderMs] = useState<number | null>(null);

  const cells = useMemo(
    () => Array.from({ length: COLS * ROWS }, (_, i) => i),
    []
  );

  const getColorForRow = (rowIndex: number) => {
    const bandRow = rowIndex % 100;
    if (bandRow < 20) return "#F97316"; // orange
    if (bandRow < 40) return "#F59E0B"; // yellow
    if (bandRow < 60) return "#22C55E"; // green
    if (bandRow < 80) return "#3B82F6"; // blue
    return "#9608CA"; // purple
  };

  const getSvgSrcForRow = (rowIndex: number) => {
    return Math.floor(rowIndex / 20) % 2 === 0
      ? "/seats-test/seats-purple.svg"
      : "/seats-test/seats-gray.svg";
  };

  useEffect(() => {
    if (mode === "svg" || mode === "html") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (renderStartRef.current != null) {
            setRenderMs((performance.now() - renderStartRef.current) / 1000);
          }
        });
      });
    }
  }, [mode, COLS, ROWS]);

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6">
      <h1 className="text-lg font-semibold text-gray-900">좌석 테스트</h1>

      <div className="mt-4 flex gap-3">
        <Button
          type="button"
          onClick={() => {
            renderStartRef.current = performance.now();
            setRenderMs(null);
            setMode("svg");
          }}
        >
          SVG 테스트
        </Button>
        <Button
          type="button"
          onClick={() => {
            renderStartRef.current = performance.now();
            setRenderMs(null);
            setMode("html");
          }}
        >
          HTML 테스트
        </Button>
      </div>

      {renderMs != null && mode !== "none" && (
        <div className="mt-2 text-sm text-gray-700 font-medium">
          {mode.toUpperCase()} 렌더링 시간: {renderMs.toFixed(2)}초
        </div>
      )}

      {mode === "svg" && (
        <div
          className="mt-6 overflow-auto"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, ${SIZE}px)`,
            gridAutoRows: `${SIZE}px`,
            gap: `${GAP}px`,
          }}
        >
          {(() => {
            const elements = [] as any[];
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                const i = r * COLS + c;
                elements.push(
                  <img
                    key={`s-${i}`}
                    src={getSvgSrcForRow(r)}
                    alt=""
                    width={SIZE}
                    height={SIZE}
                    draggable={false}
                  />
                );
              }
              if ((r + 1) % 100 === 0) {
                elements.push(
                  <div
                    key={`s-label-${r + 1}`}
                    style={{
                      gridColumn: `1 / span ${COLS}`,
                      height: SIZE,
                      lineHeight: `${SIZE}px`,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {r + 1}
                  </div>
                );
              }
            }
            return elements;
          })()}
        </div>
      )}
      {mode === "html" && (
        <div
          className="mt-6 overflow-auto"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${COLS}, ${SIZE}px)`,
            gridAutoRows: `${SIZE}px`,
            gap: `${GAP}px`,
          }}
        >
          {(() => {
            const elements = [] as any[];
            for (let r = 0; r < ROWS; r++) {
              for (let c = 0; c < COLS; c++) {
                const i = r * COLS + c;
                elements.push(
                  <div
                    key={`h-${i}`}
                    style={{
                      width: SIZE,
                      height: SIZE,
                      backgroundColor: getColorForRow(r),
                      borderRadius: 3,
                    }}
                  />
                );
              }
              if ((r + 1) % 100 === 0) {
                elements.push(
                  <div
                    key={`h-label-${r + 1}`}
                    style={{
                      gridColumn: `1 / span ${COLS}`,
                      height: SIZE,
                      lineHeight: `${SIZE}px`,
                      fontWeight: 600,
                      color: "#111827",
                    }}
                  >
                    {r + 1}
                  </div>
                );
              }
            }
            return elements;
          })()}
        </div>
      )}
    </div>
  );
}
