import { Outlet } from "react-router-dom";
import ScrollToTop from "../routes/ScrollToTop";

export default function PlainLayout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}
