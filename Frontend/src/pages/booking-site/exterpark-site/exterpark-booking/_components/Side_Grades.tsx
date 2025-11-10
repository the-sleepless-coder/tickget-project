import type { FC } from "react";

type GradeKey = "SR" | "R" | "S" | "A" | "STANDING";

type GradeMeta = Record<
  GradeKey,
  { name: string; color: string; price: number }
>;

interface SeatGradesProps {
  hallId: number | null | undefined;
  gradeMeta: GradeMeta;
}

const Row: FC<{
  label: string;
  color: string;
  price: number;
}> = ({ label, color, price }) => {
  return (
    <li className="flex items-center justify-between">
      <span className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-sm"
          style={{ background: color }}
        />
        <span className="font-semibold">{label}</span>
      </span>
      <span className="text-gray-700">{price.toLocaleString()}원</span>
    </li>
  );
};

export default function SeatGrades({ hallId, gradeMeta }: SeatGradesProps) {
  // hallId에 따라 노출 순서/구성을 분기
  // 2: SMALL (샤롯데씨어터), 3: MEDIUM(올림픽 홀), 4: LARGE(인스파이어 아레나)
  let order: GradeKey[] = ["SR", "R", "S", "A"]; // hallId=2 (VIP=SR)
  if (hallId === 3) order = ["STANDING", "SR", "R", "S"];
  if (hallId === 4) order = ["STANDING", "SR", "R", "S"];

  // hallId에 따른 컬러 오버라이드 (요청 사양)
  // hallId = 3 (올림픽 홀): STANDING #FE4AB9, R #4CA0FF, S #FFCC10, A #7C50E4
  const getColor = (k: GradeKey): string => {
    if (hallId === 3) {
      if (k === "STANDING") return "#FE4AB9";
      if (k === "R") return "#4CA0FF";
      if (k === "S") return "#FFCC10";
      if (k === "A") return "#7C50E4";
    }
    // hallId = 4 (인스파이어 아레나): STANDING #FE4AB9, VIP(SR) #7C50E4, R #4CA0FF, S #FFCC10
    if (hallId === 4) {
      if (k === "STANDING") return "#FE4AB9";
      if (k === "SR") return "#7C50E4";
      if (k === "R") return "#4CA0FF";
      if (k === "S") return "#FFCC10";
    }
    return gradeMeta[k].color;
  };

  return (
    <ul className="space-y-2">
      {order.map((k) => (
        <Row
          key={k}
          label={gradeMeta[k].name}
          color={getColor(k)}
          price={gradeMeta[k].price}
        />
      ))}
    </ul>
  );
}
