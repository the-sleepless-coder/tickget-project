import { Outlet } from "react-router-dom";
import ScrollToTop from "../routes/ScrollToTop";

export default function AuthLayout() {
  return (
    <div>
      <ScrollToTop />
      <Outlet />
    </div>
  );
}
