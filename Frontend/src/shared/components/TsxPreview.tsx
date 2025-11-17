import React, { useEffect, useState } from "react";
import * as Babel from "@babel/standalone";

type TsxPreviewProps = {
  src: string;
  className?: string;
  selectedSeatIds?: string[]; // 선택된 좌석 ID 배열 (section-row-col 형식)
  readOnly?: boolean; // 읽기 전용 모드: 선택된 좌석만 색상 표시
  disableAutoScale?: boolean; // 자동 스케일링 비활성화 (외부에서 스케일링 제어)
};

/**
 * 원격 TSX 파일을 동적으로 변환하여 렌더링합니다.
 * - TSX 파일을 fetch하여 가져옴
 * - Babel을 사용하여 TSX를 JavaScript로 변환
 * - 동적으로 컴포넌트를 생성하여 직접 렌더링
 * - iframe 없이 직접 렌더링 (빠른 로딩)
 */
export default function TsxPreview({ 
  src, 
  className,
  selectedSeatIds = [],
  readOnly = false,
  disableAutoScale = false,
}: TsxPreviewProps) {
  // 모든 hooks는 컴포넌트 최상단에 정의
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [Component, setComponent] = useState<React.ComponentType | null>(null);
  const [scale, setScale] = useState(1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);
  const scaleRef = React.useRef(1);
  const lastReadOnlyRef = React.useRef<boolean | undefined>(undefined);
  const lastSelectedSeatIdsRef = React.useRef<string>('');
  
  // readOnly 모드일 때 선택되지 않은 좌석을 회색으로 처리
  useEffect(() => {
    if (!containerRef.current || !Component) {
      return;
    }

    const currentSelectedIds = selectedSeatIds.join(',');
    
    // 실제로 변경된 경우에만 실행
    if (lastReadOnlyRef.current === readOnly && lastSelectedSeatIdsRef.current === currentSelectedIds) {
      return;
    }
    
    lastReadOnlyRef.current = readOnly;
    lastSelectedSeatIdsRef.current = currentSelectedIds;

    // readOnly가 false이면 모든 회색 처리 제거하고 원래 색상 복원
    if (!readOnly) {
      const allElements = containerRef.current.querySelectorAll("*");
      allElements.forEach((el) => {
        if (el instanceof HTMLElement) {
          if (el.style.backgroundColor === "#9ca3af") {
            el.style.backgroundColor = "";
            el.style.opacity = "";
          }
        }
        if (el instanceof SVGElement) {
          if (el.style.fill === "#9ca3af" || el.getAttribute("fill") === "#9ca3af") {
            const originalFill = el.getAttribute("data-original-fill");
            if (originalFill) {
              el.setAttribute("fill", originalFill);
              el.style.fill = "";
            } else {
              el.style.fill = "";
            }
            el.style.opacity = "";
          }
        }
      });
      return;
    }
    
    // readOnly가 true이고 selectedSeatIds가 비어있으면 모든 좌석을 회색 처리하지 않음
    if (selectedSeatIds.length === 0) {
      return;
    }



    let isProcessing = false;
    let processedElements = new WeakSet();

    // 좌석 요소를 찾아서 색상 처리
    const updateSeatColors = () => {
      if (isProcessing) return; // 이미 처리 중이면 스킵
      isProcessing = true;

      const container = containerRef.current;
      if (!container) {
        isProcessing = false;
        return;
      }

      // 모든 요소를 찾아서 좌석인지 확인 (div, svg polygon 등)
      const allElements = container.querySelectorAll("*");
      const selectedSeatIdsSet = new Set(selectedSeatIds);
      
      // 섹션 번호 추출 (section-row-col 형식에서 section만)
      const selectedSections = new Set<string>();
      selectedSeatIds.forEach((seatId) => {
        const parts = seatId.split("-");
        if (parts.length >= 1) {
          // 숫자로 변환 후 다시 문자열로 변환하여 "12"와 "012" 같은 경우 처리
          const sectionNum = String(Number(parts[0]));
          selectedSections.add(sectionNum);
          // 원본도 추가 (혹시 모를 경우를 위해)
          selectedSections.add(parts[0]);
        }
      });
      
   
      
      let processedCount = 0;
      let selectedCount = 0;
      let sectionElements = new Map<string, Set<Element>>(); // 섹션별 요소 추적

      allElements.forEach((el) => {
        // HTMLElement와 SVGElement 모두 처리
        if (!(el instanceof HTMLElement || el instanceof SVGElement)) return;
        
        // 이미 처리된 요소는 스킵
        if (processedElements.has(el)) return;

        // data attribute나 title에서 좌석 정보 추출 시도
        const seatId = 
          el.getAttribute("data-seat-id") ||
          el.getAttribute("seatid") ||
          el.getAttribute("data-id") ||
          el.getAttribute("seat-id");

        // data-section 속성에서도 섹션 번호 추출 시도
        const dataSection = el.getAttribute("data-section");
        
        // section 속성에서도 섹션 번호 추출 시도 (AI 생성 맵의 polygon에 사용)
        const sectionAttr = el.getAttribute("section");

        // title에서 좌석 정보 추출 (예: "[VIP석] 12구역-8열-9")
        const title = el.getAttribute("title") || "";
        let extractedSeatId: string | null = null;
        
        if (title) {
          // title 형식: "[VIP석] 12구역-8열-9" 또는 "[VIP석] 12-8-9" 또는 "12-8-9"
          const match = title.match(/(\d+)[구역\s-]*(\d+)[열\s-]*(\d+)/);
          if (match) {
            extractedSeatId = `${match[1]}-${match[2]}-${match[3]}`;
          }
        }
        
        // 클래스명에서도 섹션 번호 추출 시도 (예: "section-12", "sect-12")
        const className = el.getAttribute("class") || "";
        let sectionFromClass: string | null = null;
        if (className) {
          const classMatch = className.match(/(?:section|sect|sec)[-_]?(\d+)/i);
          if (classMatch) {
            sectionFromClass = classMatch[1];
          }
        }

        // 좌석 ID가 있으면 처리 (data-section이 있으면 그것도 포함)
        const finalSeatId = seatId || extractedSeatId || (dataSection ? `${dataSection}-0-0` : null);
        
        // 배경색 또는 fill 색상 확인
        const currentBg = el instanceof HTMLElement 
          ? window.getComputedStyle(el).backgroundColor
          : null;
        const fillColor = el.getAttribute("fill") || 
          (el instanceof SVGElement ? window.getComputedStyle(el).fill : null);
        
        const hasColor = (currentBg && 
          currentBg !== "rgba(0, 0, 0, 0)" && 
          currentBg !== "transparent" &&
          currentBg !== "rgb(255, 255, 255)" &&
          currentBg !== "white" &&
          currentBg !== "rgb(0, 0, 0)" &&
          currentBg !== "black") ||
          (fillColor && 
            fillColor !== "none" && 
            fillColor !== "transparent" &&
            fillColor !== "rgba(0, 0, 0, 0)");

        // 섹션 번호 추출 시도 (여러 방법)
        // section 속성을 최우선으로 확인 (AI 생성 맵의 polygon에 사용)
        let seatSection: string | null = null;
        if (sectionAttr) {
          seatSection = sectionAttr;
        } else if (dataSection) {
          seatSection = dataSection;
        } else if (finalSeatId) {
          const seatIdParts = finalSeatId.split("-");
          seatSection = seatIdParts.length >= 1 ? seatIdParts[0] : null;
        } else if (sectionFromClass) {
          seatSection = sectionFromClass;
        }
        
        // 섹션 번호 정규화 (숫자로 변환 후 다시 문자열로 변환하여 "12"와 "012" 같은 경우 처리)
        let normalizedSeatSection: string | null = null;
        if (seatSection) {
          const numSection = Number(seatSection);
          if (!isNaN(numSection)) {
            normalizedSeatSection = String(numSection);
          }
        }
        
        // 정확한 좌석 ID 매칭 또는 섹션 번호 매칭
        const exactMatch = finalSeatId ? selectedSeatIdsSet.has(finalSeatId) : false;
        const sectionMatch = (seatSection !== null && selectedSections.has(seatSection)) ||
          (normalizedSeatSection !== null && selectedSections.has(normalizedSeatSection));
        const isSelected = exactMatch || sectionMatch;
        

        
        // 섹션별 요소 추적 (섹션이 있는 경우 - 원본과 정규화된 버전 모두)
        if (seatSection) {
          if (!sectionElements.has(seatSection)) {
            sectionElements.set(seatSection, new Set());
          }
          sectionElements.get(seatSection)!.add(el);
        }
        if (normalizedSeatSection && normalizedSeatSection !== seatSection) {
          if (!sectionElements.has(normalizedSeatSection)) {
            sectionElements.set(normalizedSeatSection, new Set());
          }
          sectionElements.get(normalizedSeatSection)!.add(el);
        }
        
        if (isSelected) {
          selectedCount++;
          // 선택된 섹션의 좌석은 원래 색상 유지 (회색 처리 제거)
          if (el instanceof HTMLElement) {
            if (el.style.backgroundColor === "#9ca3af") {
              el.style.backgroundColor = "";
              el.style.opacity = "";
            }
          }
          if (el instanceof SVGElement) {
            // 회색 처리된 경우 원래 색상 복원
            if (el.style.fill === "#9ca3af" || el.getAttribute("fill") === "#9ca3af") {
              const originalFill = el.getAttribute("data-original-fill");
              if (originalFill) {
                el.setAttribute("fill", originalFill);
                el.style.fill = "";
              } else {
                el.style.fill = "";
              }
              el.style.opacity = "";
            }
            // 회색 처리되지 않았어도 원래 색상이 있으면 유지
            const currentFill = el.getAttribute("fill");
            if (currentFill && currentFill !== "#9ca3af" && !el.hasAttribute("data-original-fill")) {
              el.setAttribute("data-original-fill", currentFill);
            }
          }
          processedElements.add(el);
        } else if (hasColor) {
          // 선택되지 않은 섹션의 좌석은 회색 처리 (색상이 있는 경우만)
          if (el instanceof HTMLElement) {
            el.style.backgroundColor = "#9ca3af";
            el.style.opacity = "0.5";
          }
          if (el instanceof SVGElement) {
            // 원래 fill 색상 저장
            if (!el.hasAttribute("data-original-fill") && fillColor) {
              el.setAttribute("data-original-fill", fillColor);
            }
            el.setAttribute("fill", "#9ca3af");
            el.style.fill = "#9ca3af";
            el.style.opacity = "0.5";
          }
          processedCount++;
          processedElements.add(el);
        } else if (!seatSection && !finalSeatId && hasColor) {
          // 좌석 ID가 없지만 색상이 있는 경우
          // 작은 크기의 요소 (좌석일 가능성)이고 색상이 있으면 회색 처리
          const rect = el.getBoundingClientRect();
          const isSmallSeat = rect.width > 0 && rect.width < 50 && rect.height > 0 && rect.height < 50;
          
          // SVG 요소도 처리
          const isSVGElement = el instanceof SVGElement || 
            el.tagName === "polygon" || 
            el.tagName === "rect" || 
            el.tagName === "circle" ||
            el.tagName === "path";
          
          if ((isSmallSeat || isSVGElement) && hasColor) {
            // 원래 색상을 저장
            if (el instanceof SVGElement) {
              if (!el.hasAttribute("data-original-fill") && fillColor) {
                el.setAttribute("data-original-fill", fillColor);
              }
              el.setAttribute("fill", "#9ca3af");
              el.style.fill = "#9ca3af";
              el.style.opacity = "0.5";
            } else if (el instanceof HTMLElement) {
              el.style.backgroundColor = "#9ca3af";
              el.style.opacity = "0.5";
            }
            processedCount++;
            processedElements.add(el);
          }
        }
      });
      
      // 선택된 섹션의 모든 요소가 원래 색상을 유지하도록 보장
      // 섹션 전체를 회색 처리하지 않도록 추가 처리
      selectedSections.forEach((sectionNum) => {
        const sectionEls = sectionElements.get(sectionNum);
        if (sectionEls) {
          sectionEls.forEach((el) => {
            if (processedElements.has(el)) return;
            
            if (el instanceof HTMLElement) {
              if (el.style.backgroundColor === "#9ca3af") {
                el.style.backgroundColor = "";
                el.style.opacity = "";
              }
            }
            if (el instanceof SVGElement) {
              if (el.style.fill === "#9ca3af" || el.getAttribute("fill") === "#9ca3af") {
                const originalFill = el.getAttribute("data-original-fill");
                if (originalFill) {
                  el.setAttribute("fill", originalFill);
                  el.style.fill = "";
                } else {
                  el.style.fill = "";
                }
                el.style.opacity = "";
              }
            }
            processedElements.add(el);
          });
        }
      });

 
      
      isProcessing = false;
    };

    // 즉시 실행 (디바운싱 없이)
    updateSeatColors();

    return () => {
      isProcessing = false;
      processedElements = new WeakSet();
    };
  }, [readOnly, selectedSeatIds.join(','), Component]); // selectedSeatIds를 문자열로 변환하여 불필요한 재실행 방지

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setComponent(null);

        // URL 인코딩 (공백 등) 처리
        const encoded = src.includes(" ") ? encodeURI(src) : src;
       

        const res = await fetch(encoded, {
          credentials: "omit",
          cache: "no-cache",
          headers: { Accept: "text/plain, */*" },
          referrerPolicy: "no-referrer",
          mode: "cors",
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }

        const tsxCode = await res.text();
       

        if (cancelled) return;

        // import 문 제거
        const cleanedCode = tsxCode.replace(
          /^import\s+.*?from\s+['"].*?['"];?\s*$/gm,
          "// import removed for browser compatibility"
        );

        // Babel로 TSX 변환
        const transformed =
          Babel.transform(cleanedCode, {
            presets: [["react", { runtime: "classic" }], "typescript"],
            filename: "RemoteSeatmap.tsx",
            sourceType: "module",
          }).code || "";

      

        // export default를 변수로 변환
        let processedCode = transformed;
        processedCode = processedCode.replace(
          /export\s+default\s+([\w]+)\s*;?/g,
          "const __defaultExport = $1;"
        );
        processedCode = processedCode.replace(
          /exports\.default\s*=\s*([\w]+)\s*;?/g,
          "const __defaultExport = $1;"
        );
        processedCode = processedCode.replace(
          /module\.exports\s*=\s*([\w]+)\s*;?/g,
          "const __defaultExport = $1;"
        );

        // 컴포넌트 이름 추출
        const componentNameMatch = cleanedCode.match(
          /export\s+default\s+([\w]+)\s*;?/
        );
        const componentName = componentNameMatch
          ? componentNameMatch[1]
          : "SeatmapOverlay";

        // 모듈 래퍼로 컴포넌트 추출
        // 더 안전한 방식으로 컴포넌트 생성
        let DynamicComponent: React.ComponentType | null = null;

        try {
       

          // 모듈 래퍼 함수 생성
          const moduleCode = `
            (function(React) {
              const exports = {};
              const module = { exports };
              
              ${processedCode}
              
              // 컴포넌트 추출 (여러 패턴 시도)
              if (typeof __defaultExport !== 'undefined') {
                console.log('[TsxPreview] Found __defaultExport');
                return __defaultExport;
              }
              if (module.exports && module.exports.default) {
                console.log('[TsxPreview] Found module.exports.default');
                return module.exports.default;
              }
              if (module.exports && typeof module.exports === 'function') {
                console.log('[TsxPreview] Found module.exports (function)');
                return module.exports;
              }
              if (typeof module.exports === 'object' && module.exports !== null) {
                console.log('[TsxPreview] Found module.exports (object)');
                return module.exports;
              }
              // 컴포넌트 이름으로 직접 접근 시도
              try {
                if (typeof ${componentName} !== 'undefined') {
                  console.log('[TsxPreview] Found component by name:', '${componentName}');
                  return ${componentName};
                }
              } catch (e) {
                console.warn('[TsxPreview] Component name access failed:', e);
              }
              console.warn('[TsxPreview] No component found');
              return null;
            })
          `;

          // Function 생성자를 사용하여 모듈 함수 생성
          type ReactType = typeof React;
          const moduleFactory = new Function(
            "React",
            `return ${moduleCode}`
          ) as (React: ReactType) => React.ComponentType | null;

          if (!moduleFactory) {
            throw new Error("모듈 팩토리 함수를 생성할 수 없습니다.");
          }

          // React를 전달하여 컴포넌트 추출
          DynamicComponent = moduleFactory(React);

          if (!DynamicComponent) {
            // 대안: eval 사용 (더 유연하지만 보안 주의)
            // console.warn은 제거 - 정상적인 폴백 동작이므로 경고 불필요
            try {
              const evalCode = `
                (function(React) {
                  const exports = {};
                  const module = { exports };
                  ${processedCode}
                  return __defaultExport || module.exports?.default || module.exports || ${componentName} || null;
                })
              `;
              type ReactType = typeof React;
              const evalFactory = eval(`(${evalCode})`) as (
                React: ReactType
              ) => React.ComponentType | null;
              DynamicComponent = evalFactory(React);
            } catch (evalError) {
              console.error("[TsxPreview] eval 대안도 실패:", evalError);
            }
          }
        } catch (factoryError) {
          console.error("[TsxPreview] 모듈 래퍼 생성 실패:", factoryError);
          console.error(
            "[TsxPreview] 에러 스택:",
            factoryError instanceof Error ? factoryError.stack : "N/A"
          );
          throw new Error(
            `컴포넌트 생성 실패: ${factoryError instanceof Error ? factoryError.message : String(factoryError)}`
          );
        }

        if (!DynamicComponent || typeof DynamicComponent !== "function") {
          console.error("[TsxPreview] 최종 컴포넌트 확인 실패:", {
            DynamicComponent,
            type: typeof DynamicComponent,
            componentName,
            processedCodeLength: processedCode.length,
          });
          throw new Error(
            `컴포넌트를 찾을 수 없습니다. (컴포넌트 이름: ${componentName})`
          );
        }

        if (cancelled) return;

       
        setComponent(() => DynamicComponent);
        setLoading(false);
      } catch (e) {
        console.error("[TsxPreview] Render error", e);
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "TSX 렌더링 중 오류가 발생했습니다."
          );
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // 컴포넌트 크기 계산 및 스케일 조정 (모든 hooks는 early return 이전에)
  useEffect(() => {
    if (disableAutoScale) {
      // 자동 스케일링 비활성화 시 scale을 1로 고정
      scaleRef.current = 1;
      setScale(1);
      return;
    }

    if (!Component || !containerRef.current || !innerRef.current) return;

    const updateScale = () => {
      const container = containerRef.current;
      const inner = innerRef.current;
      if (!container || !inner) return;

      const containerRect = container.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const containerHeight = containerRect.height;

      if (containerWidth === 0 || containerHeight === 0) return;

      // 내부 컴포넌트의 실제 크기 확인
      const innerRect = inner.getBoundingClientRect();
      const innerWidth = innerRect.width || containerWidth;
      const innerHeight = innerRect.height || containerHeight;

      if (innerWidth === 0 || innerHeight === 0) return;

      // 컨테이너에 맞춰 최대한 크게 스케일 계산 (높이와 너비 모두 고려)
      const scaleX = containerWidth / innerWidth;
      const scaleY = containerHeight / innerHeight;
      const newScale = Math.min(scaleX, scaleY, 1); // 1보다 크게 확대하지 않음

      if (newScale > 0 && Math.abs(newScale - scaleRef.current) > 0.01) {
        scaleRef.current = newScale;
        setScale(newScale);
      }
    };

    // 초기 스케일 계산 (여러 번 시도)
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    [300, 600, 1000].forEach((delay) => {
      const timeoutId = setTimeout(updateScale, delay);
      timeouts.push(timeoutId);
    });
    
    // 리사이즈 이벤트 리스너
    const resizeObserver = new ResizeObserver(() => {
      setTimeout(updateScale, 100);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      timeouts.forEach(clearTimeout);
      resizeObserver.disconnect();
    };
  }, [Component, disableAutoScale]);

  if (loading) {
    return (
      <div className={className ?? ""}>
        <div className="w-full h-full grid place-items-center text-gray-600 text-sm">
          미리보기를 불러오는 중...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={className ?? ""}>
        <div className="w-full h-full grid place-items-center text-center px-3">
          <div className="text-xs text-red-600 mb-2">
            미리보기 오류: {error}
          </div>
          <a
            href={src}
            target="_blank"
            rel="noreferrer"
            className="text-purple-600 underline text-sm"
          >
            원본 파일 열기
          </a>
        </div>
      </div>
    );
  }

  if (!Component) {
    return (
      <div className={className ?? ""}>
        <div className="w-full h-full grid place-items-center text-gray-600 text-sm">
          컴포넌트를 불러올 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className ?? ""}
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "auto",
        position: "relative",
      }}
    >
      <div
        ref={innerRef}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
          width: "fit-content",
          height: "fit-content",
        }}
      >
        <Component />
      </div>
    </div>
  );
}
