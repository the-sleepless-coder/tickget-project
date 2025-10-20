import { Link } from "react-router-dom";
import { paths } from "../../app/routes/paths";

export default function HomePage() {
  return (
    <div className="p-6">
      <Link
        to={paths.iTicket}
        className="inline-flex items-center justify-center px-6 py-4 bg-blue-600 text-white text-lg font-medium rounded-none shadow-md hover:shadow-lg active:shadow-sm transition-all duration-200"
        aria-label="I 사 티켓 뽑기"
      >
        I 사 티켓 뽑기
      </Link>
    </div>
  );
}
