import { Outlet } from "react-router-dom";
import Header from "../../shared/ui/common/Header";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 py-6">
        <Outlet />
      </main>

      <footer className="bg-gray-100 text-gray-400 text-center py-4">
        © {new Date().getFullYear()} 이선좌, All rights reserved.
      </footer>
    </div>
  );
}
