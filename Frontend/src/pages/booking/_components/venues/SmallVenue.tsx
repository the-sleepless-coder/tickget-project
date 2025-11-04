export default function SmallVenue() {
  // 좌석 정사각형 크기와 간격은 Tailwind + 인라인 스타일로 조절
  const seatStyle: React.CSSProperties = {
    width: 14,
    height: 14,
  };

  // 1F: 상단으로 갈수록 좌우 여백이 커지는 형태 (이미지의 완만한 곡선 외곽을 단순화)
  // 값은 각 행의 좌우 여백(컬럼 수)이며, 가운데는 좌석으로 채웁니다.
  const firstFloorLeftRightPads: number[] = [
    12, 11, 10, 9, 8, 8, 7, 7, 6, 6, 5, 5, 4, 4, 3, 3, 2, 2, 1, 1,
  ];

  // 2F: 상단이 더 좁고 하단으로 갈수록 서서히 넓어지는 형태
  const secondFloorLeftRightPads: number[] = [
    12, 11, 10, 9, 9, 8, 8, 7, 7, 6, 6, 6,
  ];

  // 공통 렌더 함수: 좌우 여백 배열과 총 컬럼수로 그리드 생성
  const renderLevel = (pads: number[], totalCols: number) => (
    <div className="overflow-auto border rounded bg-white p-4">
      <div
        className="grid justify-center"
        style={{
          gridTemplateColumns: `repeat(${totalCols}, 14px)`,
          gridAutoRows: "14px",
          gap: "3px",
        }}
      >
        {pads.map((pad, rowIndex) =>
          Array.from({ length: totalCols }).map((_, colIndex) => {
            const isSeat = colIndex >= pad && colIndex < totalCols - pad;
            return isSeat ? (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="bg-white border border-[#cfd8dc] rounded-sm"
                style={seatStyle}
                aria-hidden
              />
            ) : (
              <div
                key={`${rowIndex}-${colIndex}`}
                style={seatStyle}
                aria-hidden
              />
            );
          })
        )}
      </div>
    </div>
  );

  // 총 컬럼 수는 너비 비율을 맞추기 위한 임의값 (이미지 대비 적정치)
  const totalColumns = 44;

  return (
    <div className="space-y-6">
      {/* 1F 좌석만 (상단 블록) */}
      {renderLevel(firstFloorLeftRightPads, totalColumns)}

      {/* 2F 좌석만 (하단 블록) */}
      {renderLevel(secondFloorLeftRightPads, totalColumns)}
    </div>
  );
}
