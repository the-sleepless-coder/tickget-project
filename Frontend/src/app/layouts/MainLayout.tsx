import { Outlet } from "react-router-dom";
import Header from "../../shared/ui/common/Header";
import Footer from "../../shared/ui/common/Footer";

export default function MainLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 overflow-x-hidden">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
