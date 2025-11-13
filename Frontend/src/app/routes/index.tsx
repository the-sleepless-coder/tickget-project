import { createBrowserRouter, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import type { ReactElement } from "react";
import MainLayout from "../layouts/MainLayout";
import PlainLayout from "../layouts/PlainLayout";
import AuthLayout from "../layouts/AuthLayout";
// AuthGuard removed because dashboard/profile routes were removed

const HomePage = lazy(() => import("../../pages/home/Home"));
// Removed BookingIndexPage usage for plain booking flow
const SelectVenuePage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/SelectVenue"
    )
);
const SelectSeatPage = lazy(
  () =>
    import("../../pages/booking-site/exterpark-site/exterpark-booking/02-Seats")
);
const PricePage = lazy(
  () =>
    import("../../pages/booking-site/exterpark-site/exterpark-booking/03-Price")
);
const OrderConfirmPage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/04-OrderConfirm"
    )
);
const PaymentPage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/05-Payment"
    )
);
const CancelFeePage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/06-CancelFee"
    )
);
const CompletePage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/07-Complete"
    )
);
const BookingWaitingPage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/00-Queue"
    )
);
const GameResultPage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/08-GameResult"
    )
);
const BookingSelectSchedulePage = lazy(
  () =>
    import(
      "../../pages/booking-site/exterpark-site/exterpark-booking/01-Schedule"
    )
);
const ITicketPage = lazy(
  () => import("../../pages/booking-site/exterpark-site/ExterparkRoom")
);
const RoomsPage = lazy(() => import("../../pages/home/RoomsList"));
const SeatsTestPage = lazy(() => import("../../pages/test/NotFound"));
const MyPageIndex = lazy(() => import("../../pages/user-page/MyPage"));
const MyPageReservationsPage = lazy(
  () => import("../../pages/user-page/MockReservations")
);
const LoginPage = lazy(() => import("../../pages/auth/login/SocialLogin"));
const SignupPage = lazy(() => import("../../pages/auth/sign-up/SignUp"));
const LoginSuccessPage = lazy(
  () => import("../../pages/auth/login/LoginSuccess")
);
const NotFoundPage = lazy(() => import("../../pages/test/NotFound"));

function withSuspense(el: ReactElement) {
  return <Suspense fallback={null}>{el}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },

      { path: "i-ticket/:roomId", element: withSuspense(<ITicketPage />) },
      { path: "i-ticket", element: withSuspense(<ITicketPage />) },
      { path: "seatstest", element: withSuspense(<SeatsTestPage />) },
      { path: "game-result", element: withSuspense(<GameResultPage />) },
      { path: "login/success", element: withSuspense(<LoginSuccessPage />) },
      {
        path: "rooms",
        element: withSuspense(<RoomsPage />),
      },
      {
        path: "mypage",
        element: <Outlet />,
        children: [
          { index: true, element: withSuspense(<MyPageIndex />) },
          {
            path: "reservations",
            element: withSuspense(<MyPageReservationsPage />),
          },
        ],
      },
      // dashboard/profile routes removed
      { path: "*", element: withSuspense(<NotFoundPage />) },
    ],
  },
  // Plain layout routes for booking flow (no global header/footer)
  {
    path: "booking",
    element: <PlainLayout />,
    children: [
      { path: "waiting", element: withSuspense(<BookingWaitingPage />) },
      {
        index: true,
        element: withSuspense(<BookingSelectSchedulePage />),
      },
      {
        path: "select-schedule",
        element: withSuspense(<BookingSelectSchedulePage />),
      },
      { path: "select-venue", element: withSuspense(<SelectVenuePage />) },
      { path: "select-seat", element: withSuspense(<SelectSeatPage />) },
      { path: "price", element: withSuspense(<PricePage />) },
      { path: "order-confirm", element: withSuspense(<OrderConfirmPage />) },
      { path: "cancel-fee", element: withSuspense(<CancelFeePage />) },
      { path: "complete", element: withSuspense(<CompletePage />) },
      { path: "payment", element: withSuspense(<PaymentPage />) },
    ],
  },
  {
    path: "auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: withSuspense(<LoginPage />) },
      { path: "signup", element: withSuspense(<SignupPage />) },
    ],
  },
  // 백엔드가 /signup/additional-info로 리다이렉트하는 경우를 처리
  {
    path: "signup",
    element: <AuthLayout />,
    children: [
      { path: "additional-info", element: withSuspense(<SignupPage />) },
    ],
  },
]);
