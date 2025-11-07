interface Inspire_AProps {
  className?: string;
  cellSize?: number;
  gap?: number;
  activeColor?: string;
  backgroundColor?: string;
  flipHorizontal?: boolean;
}

export default function Inspire_A({
  className = "",
  cellSize = 12,
  gap = 2,
  activeColor = "#cd7f5a",
  backgroundColor = "transparent",
  flipHorizontal = false,
}: Inspire_AProps) {
  // 그리드 패턴 정의 (1 = 주황색, 0 = 빈 공간)
  let pattern = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  ];

  // 좌우 반전이 필요한 경우 각 행을 반전
  if (flipHorizontal) {
    pattern = pattern.map(row => [...row].reverse());
  }

  // 패턴의 실제 열 수 계산 (첫 번째 행의 길이)
  const columns = pattern[0]?.length || 22;

  return (
    <div className={`inline-block ${className}`}>
      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${cellSize}px)`,
          gap: `${gap}px`,
        }}
      >
        {pattern.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <div
              key={`${rowIndex}-${colIndex}`}
              style={{
                width: `${cellSize}px`,
                height: `${cellSize}px`,
                backgroundColor: cell === 1 ? activeColor : backgroundColor,
              }}
            />
          ))
        )}
      </div>
    </div>
  );
}

