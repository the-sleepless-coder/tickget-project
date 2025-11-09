import "./UnderConstruction.css";

type UnderConstructionProps = {
  sizePx?: number;
  className?: string;
};

export default function UnderConstruction({
  sizePx = 6,
  className,
}: UnderConstructionProps) {
  const classes = ["p-4 sm:p-6 md:p-12", className].filter(Boolean).join(" ");
  return (
    <div
      className={`flex flex-col md:flex-row items-center justify-center w-full gap-4 sm:gap-6 md:gap-12 max-w-full ${classes}`}
    >
      {/* 좌측 영역 - 애니메이션 */}
      <div className="w-full md:w-1/4 flex items-center justify-center md:pr-6">
        <div
          className="flex justify-center items-center relative"
          style={{ width: "fit-content", marginLeft: `-${17 * sizePx}px` }}
        >
          <div
            className="construction"
            style={
              {
                "--pixel-size": `${sizePx}px`,
              } as React.CSSProperties
            }
            aria-label="Under construction animation"
          />
        </div>
      </div>

      {/* 우측 영역 - 텍스트 */}
      <div className="w-full md:w-1/2 flex flex-col items-center md:items-start justify-center md:pl-6 text-center md:text-left px-2 sm:px-4">
        <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-5xl font-bold text-neutral-900 mb-2 sm:mb-4 break-words w-full">
          UNDER CONSTRUCTION
        </h2>
        <p className="text-sm sm:text-base md:text-lg lg:text-xl text-neutral-600 break-words w-full">
          Sorry, This page is under construction.
        </p>
      </div>
    </div>
  );
}
