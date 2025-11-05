export default function SmallVenue() {
  // 좌석 정사각형 크기와 간격은 Tailwind + 인라인 스타일로 조절
  const seatStyle: React.CSSProperties = {
    width: 8,
    height: 8,
  };

  // 직사각형 블록 렌더링 (columns x rows)
  const renderBlock = (columns: number, rows: number, keyPrefix: string) => (
    <div
      className="grid justify-center"
      style={{
        gridTemplateColumns: `repeat(${columns}, 8px)`,
        gridAutoRows: "8px",
        gap: "2px",
      }}
    >
      {Array.from({ length: rows }).map((_, rowIndex) =>
        Array.from({ length: columns }).map((_, colIndex) => (
          <div
            key={`${keyPrefix}${rowIndex}-${colIndex}`}
            className="bg-[#cfd8dc]"
            style={seatStyle}
            aria-hidden
          />
        ))
      )}
    </div>
  );

  return (
    <div
      className="grid place-content-center w-full h-full"
      style={{
        // 3열 고정, 각 칸은 컨텐츠(블록) 크기에 맞춤
        gridTemplateColumns: "repeat(3, max-content)",
        gap: "16px",
      }}
    >
      {/* 1층 - 1행 (좌, 중, 우) */}
      <div>{renderBlock(14, 20, "1F-r1-c1-")}</div>
      <div>{renderBlock(16, 23, "1F-r1-c2-")}</div>
      <div>{renderBlock(14, 20, "1F-r1-c3-")}</div>

      {/* 층 사이 여백 */}
      <div style={{ gridColumn: "1 / 4", height: 8 }} />

      {/* 2층 - 1행 (좌, 중, 우) */}
      <div>{renderBlock(14, 7, "2F-r1-c1-")}</div>
      <div>{renderBlock(16, 7, "2F-r1-c2-")}</div>
      <div>{renderBlock(14, 7, "2F-r1-c3-")}</div>

      {/* 2층 - 2행 (좌, 중, 우) */}
      <div>{renderBlock(14, 5, "2F-r2-c1-")}</div>
      <div>{renderBlock(16, 5, "2F-r2-c2-")}</div>
      <div>{renderBlock(14, 5, "2F-r2-c3-")}</div>
    </div>
  );
}
