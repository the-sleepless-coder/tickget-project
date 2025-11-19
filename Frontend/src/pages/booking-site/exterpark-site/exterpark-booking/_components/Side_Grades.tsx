import type { FC } from "react";

type GradeKey = "SR" | "R" | "S" | "A" | "STANDING";

type GradeMeta = Record<
  GradeKey,
  { name: string; color: string; price: number }
>;

interface SeatGradesProps {
  hallId: number | null | undefined;
  gradeMeta: GradeMeta;
  /**
   * AI 생성 공연장 여부 (hallId 5 이상 또는 hallType === "AI_GENERATED")
   */
  isAIGenerated?: boolean;
  /**
   * AI 생성 공연장에서 사용할 좌석 등급 노출 순서
   */
  aiGradeOrder?: GradeKey[];
  /**
   * AI 생성 공연장에서 사용할 등급별 색상 매핑
   */
  aiGradeColors?: Partial<Record<GradeKey, string>>;
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

export default function SeatGrades({
  hallId,
  gradeMeta,
  isAIGenerated,
  aiGradeOrder,
  aiGradeColors,
}: SeatGradesProps) {
  // hallId에 따라 노출 순서/구성을 분기
  // 2: SMALL (샤롯데씨어터), 3: MEDIUM(올림픽 홀), 4: LARGE(인스파이어 아레나)
  let order: GradeKey[] = ["SR", "R", "S", "A"]; // hallId=2 (VIP=SR)
  if (hallId === 3) order = ["STANDING", "SR", "R", "S"];
  if (hallId === 4) order = ["STANDING", "SR", "R", "S"];
  // AI 생성 공연장: 외부에서 계산한 순서를 우선 사용
  if (isAIGenerated && aiGradeOrder && aiGradeOrder.length > 0) {
    order = aiGradeOrder;
  }

  // hallId에 따른 컬러 오버라이드 (요청 사양)
  // hallId = 3 (올림픽 홀): STANDING #FE4AB9, R #4CA0FF, S #FFCC10, A #7C50E4
  const getColor = (k: GradeKey): string => {
    // AI 생성 공연장: 생성된 섹션의 색상 사용
    if (isAIGenerated && aiGradeColors && aiGradeColors[k]) {
      return aiGradeColors[k] as string;
    }

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

  // hallId / AI 여부에 따른 라벨 오버라이드
  // hallId = 4 (인스파이어 아레나): FE4AB9 = "스탠딩", 7C50E4 = "VIP석", 4CA0FF = "R석", FFCC10 = "S석"
  const getLabel = (k: GradeKey): string => {
    // AI 생성 공연장 공통 라벨
    if (isAIGenerated) {
      if (k === "STANDING") return "스탠딩";
      if (k === "SR") return "VIP석";
      if (k === "R") return "R석";
      if (k === "S") return "S석";
    }

    if (hallId === 4) {
      if (k === "STANDING") return "스탠딩";
      if (k === "SR") return "VIP석";
      if (k === "R") return "R석";
      if (k === "S") return "S석";
    }
    return gradeMeta[k].name;
  };

  return (
    <ul className="space-y-2">
      {order.map((k) => (
        <Row
          key={k}
          label={getLabel(k)}
          color={getColor(k)}
          price={gradeMeta[k].price}
        />
      ))}
    </ul>
  );
}
