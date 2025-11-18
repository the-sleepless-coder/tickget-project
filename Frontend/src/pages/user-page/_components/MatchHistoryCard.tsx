import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MatchDetailContent from "./MatchDetailContent";

interface MatchHistoryCardProps {
  title: string;
  participants: string;
  venue: string;
  venueType: string;
  tags: Array<{ label: string; color: string; className?: string }>;
  date?: string;
  time?: string;
  mySeatArea?: string;
  mySeatSection?: string;
  users?: Array<{
    id: number;
    nickname: string;
    rank: number;
    seatArea: string;
  }>;
  userSuccess?: boolean;
  totalTime?: number;
  isExpanded?: boolean;
  onExpand?: () => void;
  onUserClick?: (user: {
    id: number;
    nickname: string;
    rank: number;
    seatArea: string;
  }) => void;
  isAIGenerated?: boolean;
  tsxUrl?: string | null;
  hallId?: number;
  roomType?: "SOLO" | "MULTI";
}

export default function MatchHistoryCard({
  title,
  participants,
  venue,
  venueType,
  tags,
  date,
  time,
  mySeatArea,
  mySeatSection,
  users,
  userSuccess,
  totalTime,
  isExpanded = false,
  onExpand,
  onUserClick,
  isAIGenerated,
  tsxUrl,
  hallId,
  roomType,
}: MatchHistoryCardProps) {
  const getTagColorClass = (color: string) => {
    switch (color) {
      case "red":
        return "bg-red-400";
      case "blue":
        return "bg-blue-400";
      case "green":
        return "bg-green-400";
      default:
        return "bg-neutral-400";
    }
  };

  return (
    <div className="cursor-pointer rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between p-4" onClick={onExpand}>
        <div className="flex-1">
          <h3 className="mb-2 text-base font-bold text-neutral-900">{title}</h3>
          <div className="mb-3 text-sm text-neutral-600">
            <span className="mr-2">{participants}</span>
            <span className="mr-2">|</span>
            <span>
              {venue} | {venueType}
            </span>
          </div>
          <div className="flex gap-2">
            {tags.map((tag, index) => (
              <span
                key={index}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  tag.className || `text-white ${getTagColorClass(tag.color)}`
                }`}
              >
                {tag.label}
              </span>
            ))}
          </div>
        </div>
        <div className="ml-6 flex items-center gap-6 text-xs">
          {date && (
            <div className="text-neutral-500">
              <div className="font-medium text-neutral-900">경기 날짜</div>
              <div>{date.replace(/-/g, ".")}</div>
            </div>
          )}
          {time && (
            <div className="text-neutral-500">
              <div className="font-medium text-neutral-900">경기 시간</div>
              <div>{time}</div>
            </div>
          )}
          <div className="text-neutral-500">
            <div className="font-medium text-neutral-900">경기 결과</div>
            <div
              className={
                userSuccess === false ? "text-red-600" : "text-green-600"
              }
            >
              {userSuccess === false ? "실패" : "성공"}
            </div>
          </div>
          <div className="ml-4 text-neutral-400 hover:text-neutral-600">
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </div>
        </div>
      </div>

      {/* 확장된 내용 */}
      {isExpanded && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-4 overflow-x-auto">
          {users && mySeatArea && mySeatSection ? (
            <MatchDetailContent
              mySeatArea={mySeatArea}
              mySeatSection={mySeatSection}
              users={users}
              totalTime={totalTime}
              onUserClick={onUserClick}
              isAIGenerated={isAIGenerated}
              tsxUrl={tsxUrl}
              hallId={hallId}
              roomType={roomType}
            />
          ) : (
            <div className="space-y-3 text-sm text-neutral-700">
              <div className="font-semibold">추가 상세 정보</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-neutral-500">경기 날짜:</span>
                  <span className="ml-2">
                    {date ? date.replace(/-/g, ".") : "-"}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">경기 시간:</span>
                  <span className="ml-2">{time || "-"}</span>
                </div>
                <div>
                  <span className="text-neutral-500">경기 결과:</span>
                  <span className="ml-2">성공</span>
                </div>
                <div>
                  <span className="text-neutral-500">좌석 번호:</span>
                  <span className="ml-2">A-15</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
