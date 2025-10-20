import { Outlet, Link } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-600 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">PJT-Ticketing</h1>
            <nav className="hidden md:flex space-x-6">
              <Link to="/" className="hover:text-blue-200 transition-colors">
                Home
              </Link>
              <Link
                to="/booking"
                className="hover:text-blue-200 transition-colors"
              >
                Booking
              </Link>
              <Link
                to="/dashboard"
                className="hover:text-blue-200 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/profile"
                className="hover:text-blue-200 transition-colors"
              >
                Profile
              </Link>
              <Link
                to="/i-ticket"
                className="hover:text-blue-200 transition-colors"
              >
                I사 티켓
              </Link>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 py-6">
        <Outlet />
      </main>

      <footer className="bg-gray-800 text-white text-center py-4">
        © {new Date().getFullYear()} PJT-Ticketing
      </footer>
    </div>
  );
}
