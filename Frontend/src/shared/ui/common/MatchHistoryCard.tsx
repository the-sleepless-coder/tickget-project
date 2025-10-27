import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

interface MatchHistoryCardProps {
  title: string;
  participants: string;
  venue: string;
  venueType: string;
  tags: Array<{ label: string; color: string }>;
  onExpand?: () => void;
}

export default function MatchHistoryCard({
  title,
  participants,
  venue,
  venueType,
  tags,
  onExpand,
}: MatchHistoryCardProps) {
  const getTagColorClass = (color: string) => {
    switch (color) {
      case 'red':
        return 'bg-red-400';
      case 'blue':
        return 'bg-blue-400';
      case 'green':
        return 'bg-green-400';
      default:
        return 'bg-neutral-400';
    }
  };

  return (
    <div className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 bg-white p-4 transition-shadow hover:shadow-md">
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
              className={`rounded-full px-3 py-1 text-xs font-medium text-white ${getTagColorClass(tag.color)}`}
            >
              {tag.label}
            </span>
          ))}
        </div>
      </div>
      <button
        onClick={onExpand}
        className="ml-4 text-neutral-400 hover:text-neutral-600"
        aria-label="Expand details"
      >
        <ExpandMoreIcon />
      </button>
    </div>
  );
}

