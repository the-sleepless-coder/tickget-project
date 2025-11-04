import { Link } from "react-router-dom";
import { paths } from "../../../app/routes/paths";

export default function SelectVenuePage() {
  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">공연장 선택</h1>
      <div className="space-y-2">
        <Link
          className="block border rounded p-3 hover:bg-gray-50"
          to={`${paths.booking.selectSeat}?venue=small`}
        >
          소형 공연장으로 이동
        </Link>
        <Link
          className="block border rounded p-3 hover:bg-gray-50"
          to={`${paths.booking.selectSeat}?venue=medium`}
        >
          중형 공연장으로 이동
        </Link>
        <Link
          className="block border rounded p-3 hover:bg-gray-50"
          to={`${paths.booking.selectSeat}?venue=large`}
        >
          대형 공연장으로 이동
        </Link>
      </div>
    </div>
  );
}
