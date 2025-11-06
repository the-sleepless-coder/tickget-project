import { createBrowserRouter, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import type { ReactElement } from "react";
import MainLayout from "../layouts/MainLayout";
import PlainLayout from "../layouts/PlainLayout";
import AuthLayout from "../layouts/AuthLayout";
// AuthGuard removed because dashboard/profile routes were removed

const HomePage = lazy(() => import("../../pages/home"));
// Removed BookingIndexPage usage for plain booking flow
const SelectVenuePage = lazy(
  () =>
    import("../../pages/ticketing/exterpark-site/exterpark-booking/SelectVenue")
);
const SelectSeatPage = lazy(
  () =>
    import("../../pages/ticketing/exterpark-site/exterpark-booking/SelectSeat")
);
const PricePage = lazy(
  () => import("../../pages/ticketing/exterpark-site/exterpark-booking/Price")
);
const OrderConfirmPage = lazy(
  () =>
    import(
      "../../pages/ticketing/exterpark-site/exterpark-booking/OrderConFirm"
    )
);
const PaymentPage = lazy(
  () => import("../../pages/ticketing/exterpark-site/exterpark-booking/Payment")
);
const CancelFeePage = lazy(
  () =>
    import("../../pages/ticketing/exterpark-site/exterpark-booking/CancelFee")
);
const CompletePage = lazy(
  () =>
    import("../../pages/ticketing/exterpark-site/exterpark-booking/Complete")
);
const BookingWaitingPage = lazy(
  () => import("../../pages/ticketing/exterpark-site/exterpark-booking/Waiting")
);
const GameResultPage = lazy(() => import("../../pages/ticketing/GameResult"));
const BookingSelectSchedulePage = lazy(
  () =>
    import(
      "../../pages/ticketing/exterpark-site/exterpark-booking/SelectSchedule"
    )
);
const ITicketPage = lazy(
  () => import("../../pages/ticketing/exterpark-site/Exterpark")
);
const RoomsPage = lazy(() => import("../../pages/room/RoomsList"));
const SeatsTestPage = lazy(() => import("../../pages/test/NotFound"));
const MyPageIndex = lazy(() => import("../../pages/my-page/MyPage"));
const MyPageReservationsPage = lazy(
  () => import("../../pages/my-page/MockReservations")
);
const LoginPage = lazy(() => import("../../pages/auth/login/SocialLogin"));
const SignupPage = lazy(() => import("../../pages/auth/sign-up/SignUp"));
const NotFoundPage = lazy(() => import("../../pages/test/NotFound"));

function withSuspense(el: ReactElement) {
  return <Suspense fallback={null}>{el}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },

      { path: "i-ticket", element: withSuspense(<ITicketPage />) },
      { path: "seatstest", element: withSuspense(<SeatsTestPage />) },
      { path: "game-result", element: withSuspense(<GameResultPage />) },
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
]);
