import { Outlet, Link } from "react-router-dom";

export default function BookingIndexPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl">Booking</h2>
      <nav className="space-x-3">
        <Link to="select-venue" className="underline">
          Select Venue
        </Link>
        <Link to="select-seat" className="underline">
          Select Seat
        </Link>
        <Link to="payment" className="underline">
          Payment
        </Link>
      </nav>
      <Outlet />
    </div>
  );
}
