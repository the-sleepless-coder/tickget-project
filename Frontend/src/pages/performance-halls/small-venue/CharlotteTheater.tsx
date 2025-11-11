type SmallVenueSeat = {
  id: string;
  gradeLabel: string;
  label: string;
  price?: number;
};

export default function SmallVenue({
  selectedIds = [],
  onToggleSeat,
  takenSeats = new Set<string>(),
}: {
  selectedIds?: string[];
  onToggleSeat?: (seat: SmallVenueSeat) => void;
  takenSeats?: Set<string>; // section-row-col 형식의 TAKEN 좌석 ID Set
}) {
  // 좌석 정사각형 크기와 간격은 Tailwind + 인라인 스타일로 조절
  const seatStyle: React.CSSProperties = {
    width: 7.5,
    height: 7.5,
  };

  type BlockPos = "left" | "center" | "right";
  const COLORS = {
    OP: "#A0D53F",
    VIP: "#7C68EE",
    R: "#1CA814",
    S: "#17B3FF",
    A: "#FB7E4E",
    DEFAULT: "#cfd8dc",
  } as const;

  // 좌석 색상 결정 (행/열 기반, 1-base)
  const getSeatColor = (
    floor: 1 | 2,
    block: BlockPos,
    row: number,
    col: number
  ): string => {
    if (floor === 1) {
      // OP: 1~2행 전체
      if (row >= 1 && row <= 2) return COLORS.OP;

      // 3~20행: 좌우 블록은 세로 구간, 중앙은 VIP
      if (row >= 3 && row <= 20) {
        if (block === "left") {
          // 좌 블록: VIP 9~14, R 1~8
          if (col >= 9 && col <= 14) return COLORS.VIP;
          if (col >= 1 && col <= 8) return COLORS.R;
          return COLORS.DEFAULT;
        }
        if (block === "right") {
          // 우 블록: VIP 1~6, R 7~14
          if (col >= 1 && col <= 6) return COLORS.VIP;
          if (col >= 7 && col <= 14) return COLORS.R;
          return COLORS.DEFAULT;
        }
        // center
        return COLORS.VIP;
      }

      // 21~23행: 전체 R
      if (row >= 21 && row <= 23) return COLORS.R;

      return COLORS.DEFAULT;
    }

    // 2층 세로 분할: 상단(1~7행)
    if (row >= 1 && row <= 7) {
      if (block === "left") {
        // 좌 블록: 1~2행은 VIP/R 세로 분할, 3~4행 R 전체, 5~7행 S 전체
        if (row <= 2) {
          if (col >= 9 && col <= 14) return COLORS.VIP; // VIP 9~14
          if (col >= 1 && col <= 8) return COLORS.R; // R 1~8
          return COLORS.DEFAULT;
        }
        if (row <= 4) return COLORS.R; // 3~4행 R 전체
        return COLORS.S; // 5~7행 S 전체
      }
      if (block === "right") {
        // 우 블록: 1~2행은 VIP/R 세로 분할, 3~4행 R 전체, 5~7행 S 전체
        if (row <= 2) {
          if (col >= 1 && col <= 6) return COLORS.VIP; // VIP 1~6
          if (col >= 7 && col <= 14) return COLORS.R; // R 7~14
          return COLORS.DEFAULT;
        }
        if (row <= 4) return COLORS.R; // 3~4행 R 전체
        return COLORS.S; // 5~7행 S 전체
      }
      // center 블록은 행 기준 유지
      if (row <= 2) return COLORS.VIP;
      if (row <= 4) return COLORS.R;
      return COLORS.S; // 5~7행
    }

    // 하단(8~12행): A석
    if (row >= 8 && row <= 12) return COLORS.A;
    return COLORS.DEFAULT;
  };

  // 직사각형 블록 렌더링 (columns x rows)
  const renderBlock = (
    columns: number,
    rows: number,
    keyPrefix: string,
    floor: 1 | 2,
    block: BlockPos,
    rowOffset: number = 0,
    skipRows: number[] = [],
    trimByRow?: Record<number, number>,
    hideColsByRow?: Record<number, Array<number | [number, number]>>,
    columnOffsetAcross44: number = 0,
    displayRowOffset: number = 0,
    fixedDisplayRow?: number
  ) => (
    <div
      className="grid justify-center"
      style={{
        gridTemplateColumns: `repeat(${columns}, 7px)`,
        gridAutoRows: "7.1px",
        gap: "3.05px",
      }}
    >
      {Array.from({ length: rows }).map((_, rowIndex) => {
        const rowNo = rowIndex + 1;
        const effectiveRowNo = rowOffset + rowNo; // 전역 행 번호(1F 기준)
        const isHiddenRow = skipRows.includes(rowNo);
        const trim = trimByRow?.[effectiveRowNo] ?? 0;
        const extraHides = hideColsByRow?.[effectiveRowNo];
        return Array.from({ length: columns }).map((_, colIndex) => {
          const base = floor === 1 ? 0 : 3;
          const sectionPart = String(
            block === "left"
              ? base + 1
              : block === "center"
                ? base + 2
                : base + 3
          );
          const row = fixedDisplayRow ?? displayRowOffset + rowNo; // 열
          const col = columnOffsetAcross44 + (colIndex + 1); // 행

          const seatColor = getSeatColor(
            floor,
            block,
            effectiveRowNo,
            colIndex + 1
          );
          const isOpSeat = seatColor === COLORS.OP;
          // 선점 API용 grade 코드 (석 제외)
          const gradeCode =
            seatColor === COLORS.OP
              ? "STANDING"
              : seatColor === COLORS.VIP
                ? "VIP"
                : seatColor === COLORS.R
                  ? "R"
                  : seatColor === COLORS.S
                    ? "S"
                    : seatColor === COLORS.A
                      ? "A"
                      : "R";
          const displaySection = seatColor === COLORS.OP ? "0" : sectionPart;
          const displayRowInSection =
            floor === 2 ? (rowOffset >= 7 ? 7 + rowNo : rowNo) : rowNo;
          const seatId = `small-${floor}-${displaySection}-${row}-${col}`;
          const isSelected = selectedIds.includes(seatId);

          // TAKEN 좌석 확인 (API 응답은 section-row-col 형식)
          const takenSeatId = `${displaySection}-${displayRowInSection}-${col}`;
          const isTaken = takenSeats.has(takenSeatId);

          const opacityVal = (() => {
            if (isOpSeat) return 0;
            if (isHiddenRow) return 0;
            if (isTaken) return 0; // TAKEN 좌석은 투명 처리
            if (
              trim > 0 &&
              ((block === "left" && colIndex + 1 <= trim) ||
                (block === "right" && colIndex + 1 > columns - trim))
            )
              return 0;
            if (extraHides && extraHides.length > 0) {
              const colNo = colIndex + 1;
              for (const spec of extraHides) {
                if (typeof spec === "number") {
                  if (colNo === spec) return 0;
                } else {
                  const [from, to] = spec as [number, number];
                  if (colNo >= from && colNo <= to) return 0;
                }
              }
            }
            return 1;
          })();
          const activeValue = opacityVal === 0 ? "0" : "1";
          const customSeatProps = {
            seatid: seatId,
            grade: gradeCode,
            section: displaySection,
            row: String(displayRowInSection),
            col: String(col),
            active: activeValue,
          };
          return (
            <div
              key={`${keyPrefix}${rowIndex}-${colIndex}`}
              // 원래 티켓팅 사이트에서 행, 열이 바뀌어 있음, 행, 열 순서를 바꿔서 표시
              title={`[${gradeCode}석] ${displaySection}구역-${displayRowInSection}열-${col}`}
              {...(customSeatProps as Record<string, string>)}
              style={{
                ...seatStyle,
                backgroundColor: isSelected ? "#4a4a4a" : seatColor,
                cursor: opacityVal === 0 ? "default" : "pointer",
                opacity: opacityVal,
                pointerEvents: opacityVal === 0 ? "none" : "auto",
              }}
              onClick={() => {
                if (opacityVal === 0) return;
                // TAKEN 좌석은 클릭 불가
                if (isTaken) {
                  console.log(
                    "[seat-click] TAKEN 좌석은 선택할 수 없습니다:",
                    takenSeatId
                  );
                  return;
                }
                onToggleSeat?.({
                  id: seatId,
                  gradeLabel: gradeCode,
                  label: `${displaySection}구역-${displayRowInSection}열-${col}`,
                });
              }}
            />
          );
        });
      })}
    </div>
  );

  return (
    <div
      className="grid place-content-center w-full h-full"
      style={{
        // 3열 고정, 각 칸은 컨텐츠(블록) 크기에 맞춤
        gridTemplateColumns: "repeat(3, max-content)",
        columnGap: "14px",
        rowGap: "16px",
        transform: "translateY(25px)",
      }}
    >
      {/* 1층 - 1행 (좌, 중, 우) */}
      <div>
        {/* 1F 좌 블록: 앞 1행(투명) + 간격 + 3~23행 */}
        <div style={{ height: 4 }} />
        {renderBlock(
          14,
          1,
          "1F-r1-c1-front",
          1,
          "left",
          0,
          [1],
          undefined,
          undefined,
          0,
          0,
          1
        )}
        <div style={{ height: 6 }} />
        {renderBlock(
          14,
          21,
          "1F-r1-c1-rest",
          1,
          "left",
          2,
          [21],
          {
            3: 14,
            4: 10,
            5: 9,
            6: 8,
            7: 7,
            8: 6,
            9: 6,
            10: 5,
            11: 4,
            12: 4,
            13: 3,
            14: 2,
            15: 2,
            16: 1,
          },
          undefined,
          0,
          1
        )}
      </div>
      <div>
        {/* 1F 중앙 블록: 1행 분리 + 간격 + 3~23행 (2행 제외) */}
        <div style={{ height: 2 }} />
        {renderBlock(
          15,
          1,
          "1F-r1-c2-front",
          1,
          "center",
          0,
          [],
          undefined,
          undefined,
          14,
          0,
          1
        )}
        <div style={{ height: 8 }} />
        {renderBlock(
          16,
          21,
          "1F-r1-c2-rest",
          1,
          "center",
          2,
          [],
          undefined,
          {
            5: [16],
            7: [16],
            9: [16],
            11: [16],
            13: [16],
            15: [16],
            17: [16],
            19: [16],
            21: [16],
            23: [
              [1, 4] as [number, number],
              7,
              10,
              [13, 16] as [number, number],
            ],
          },
          14,
          1
        )}
      </div>
      <div>
        {/* 1F 우 블록: 앞 1행(투명) + 간격 + 3~23행 */}
        <div style={{ height: 4 }} />
        {renderBlock(
          14,
          1,
          "1F-r1-c3-front",
          1,
          "right",
          0,
          [1],
          undefined,
          undefined,
          30,
          0,
          1
        )}
        <div style={{ height: 6 }} />
        {renderBlock(
          14,
          21,
          "1F-r1-c3-rest",
          1,
          "right",
          2,
          [21],
          {
            3: 14,
            4: 10,
            5: 9,
            6: 8,
            7: 7,
            8: 6,
            9: 6,
            10: 5,
            11: 4,
            12: 4,
            13: 3,
            14: 2,
            15: 2,
            16: 1,
          },
          undefined,
          30,
          1
        )}
      </div>

      {/* 층 사이 여백 */}
      <div style={{ gridColumn: "1 / 4", height: 39 }} />

      {/* 2층 - 1행/2행: 줄간 간격 축소 */}
      <div style={{ gridColumn: "1 / 4" }}>
        <div
          className="grid justify-center"
          style={{
            gridTemplateColumns: "repeat(3, max-content)",
            columnGap: "14px",
            rowGap: "13px",
          }}
        >
          {/* 2층 1행 */}
          <div>
            {renderBlock(
              14,
              7,
              "2F-r1-c1-",
              2,
              "left",
              0,
              [],
              undefined,
              { 1: [1], 2: [1] },
              0,
              22
            )}
          </div>
          <div>
            {renderBlock(
              16,
              7,
              "2F-r1-c2-",
              2,
              "center",
              0,
              [],
              undefined,
              { 2: [16], 4: [16], 6: [16] },
              14,
              22
            )}
          </div>
          <div>
            {renderBlock(
              14,
              7,
              "2F-r1-c3-",
              2,
              "right",
              0,
              [],
              undefined,
              { 1: [14], 2: [14] },
              30,
              22
            )}
          </div>

          {/* 2층 2행 */}
          <div>
            {renderBlock(
              14,
              5,
              "2F-r2-c1-",
              2,
              "left",
              7,
              [],
              undefined,
              undefined,
              0,
              29
            )}
          </div>
          <div>
            {renderBlock(
              16,
              5,
              "2F-r2-c2-",
              2,
              "center",
              7,
              [],
              undefined,
              { 1: [16], 3: [16], 5: [3, 13, 16] },
              14,
              29
            )}
          </div>
          <div>
            {renderBlock(
              14,
              5,
              "2F-r2-c3-",
              2,
              "right",
              7,
              [],
              undefined,
              undefined,
              30,
              29
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
