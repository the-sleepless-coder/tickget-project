import React, { useEffect, useState } from "react";
import * as Babel from "@babel/standalone";

type TsxPreviewProps = {
  src: string;
  className?: string;
};

/**
 * 원격 TSX 파일을 동적으로 변환하여 렌더링합니다.
 * - TSX 파일을 fetch하여 가져옴
 * - Babel을 사용하여 TSX를 JavaScript로 변환
 * - 동적으로 컴포넌트를 생성하여 직접 렌더링
 * - iframe 없이 직접 렌더링 (빠른 로딩)
 */
export default function TsxPreview({ src, className }: TsxPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [Component, setComponent] = useState<React.ComponentType | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setComponent(null);

        // URL 인코딩 (공백 등) 처리
        const encoded = src.includes(" ") ? encodeURI(src) : src;
        console.log("[TsxPreview] Fetch TSX", { src, encoded });

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
        console.log("[TsxPreview] TSX length", tsxCode.length);

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

        console.log("[TsxPreview] Transformed length", transformed.length);
        console.log(
          "[TsxPreview] Transformed code preview:",
          transformed.slice(0, 500)
        );

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
          console.log("[TsxPreview] 컴포넌트 이름:", componentName);
          console.log(
            "[TsxPreview] Processed code preview:",
            processedCode.slice(0, 500)
          );

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

        console.log("[TsxPreview] Component created successfully");
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
      className={className ?? ""}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Component />
      </div>
    </div>
  );
}
