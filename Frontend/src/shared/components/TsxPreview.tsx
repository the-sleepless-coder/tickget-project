import React, { useEffect, useMemo, useState } from "react";
import * as Babel from "@babel/standalone";

type TsxPreviewProps = {
  src: string;
  className?: string;
};

/**
 * 원격 TSX 파일을 불러와 런타임 트랜스파일 후 React 컴포넌트로 렌더링합니다.
 * - 의존성: @babel/standalone
 * - 가정: TSX는 export default로 React 컴포넌트를 내보냅니다.
 */
export default function TsxPreview({ src, className }: TsxPreviewProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [Rendered, setRendered] = useState<React.ComponentType | null>(null);

  const babelOptions = useMemo(
    () => ({
      presets: [
        ["react", { runtime: "classic" }], // React.createElement 기반
        "typescript",
      ],
      plugins: ["transform-modules-commonjs"],
      filename: "RemoteSeatmap.tsx",
      sourceType: "module" as const,
    }),
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        setRendered(null);
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
        const code = await res.text();
        console.log("[TsxPreview] TSX length", code.length);

        const transformed = Babel.transform(code, babelOptions).code || "";
        console.log("[TsxPreview] Transformed length", transformed.length);

        // CommonJS exports 객체로 export default를 회수
        const exportsObj: Record<string, unknown> = {};
        // eslint-disable-next-line no-new-func
        const factory = new Function(
          "React",
          "exports",
          `${transformed}; return exports.default || exports.Component || null;`
        );
        const Comp = factory(React, exportsObj) as React.ComponentType | null;
        if (!cancelled) {
          if (Comp) {
            setRendered(() => Comp);
          } else {
            setError("TSX에서 기본 내보내기(default export)를 찾을 수 없습니다.");
          }
        }
      } catch (e) {
        console.error("[TsxPreview] Render error", e);
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "TSX 렌더링 중 오류가 발생했습니다."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [src, babelOptions]);

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
          <div className="text-xs text-red-600 mb-2">미리보기 오류: {error}</div>
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
  if (!Rendered) {
    return (
      <div className={className ?? ""}>
        <div className="w-full h-full grid place-items-center text-sm text-gray-600">
          렌더링할 컴포넌트가 없습니다.
        </div>
      </div>
    );
  }
  return (
    <div className={className ?? ""}>
      <div className="w-full h-full overflow-auto">
        <Rendered />
      </div>
    </div>
  );
}

