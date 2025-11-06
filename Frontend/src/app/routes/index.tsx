import { createBrowserRouter, Outlet } from "react-router-dom";
import { lazy, Suspense } from "react";
import type { ReactElement } from "react";
import MainLayout from "../layouts/MainLayout";
import PlainLayout from "../layouts/PlainLayout";
import AuthLayout from "../layouts/AuthLayout";
import AuthGuard from "./guards/AuthGuard";

const HomePage = lazy(() => import("../../pages/home"));
// Removed BookingIndexPage usage for plain booking flow
const SelectVenuePage = lazy(() => import("../../pages/booking/select-venue"));
const SelectSeatPage = lazy(() => import("../../pages/booking/select-seat"));
const PricePage = lazy(() => import("../../pages/booking/price"));
const OrderConfirmPage = lazy(
  () => import("../../pages/booking/order-confirm")
);
const PaymentPage = lazy(() => import("../../pages/booking/payment"));
const CancelFeePage = lazy(() => import("../../pages/booking/cancel-fee"));
const CompletePage = lazy(() => import("../../pages/booking/complete"));
const BookingWaitingPage = lazy(() => import("../../pages/booking/waiting"));
const GameResultPage = lazy(() => import("../../pages/game-result"));
const BookingSelectSchedulePage = lazy(
  () => import("../../pages/booking/select-schedule")
);
const DashboardPage = lazy(() => import("../../pages/dashboard"));
const ProfilePage = lazy(() => import("../../pages/profile"));
const ITicketPage = lazy(
  () => import("../../pages/Ticketing/Exterpark/Exterpark")
);
const RoomsPage = lazy(() => import("../../pages/rooms"));
const SeatsTestPage = lazy(() => import("../../pages/seatstest"));
const MyPageIndex = lazy(() => import("../../pages/mypage"));
const MyPageReservationsPage = lazy(
  () => import("../../pages/mypage/reservations")
);
const LoginPage = lazy(() => import("../../pages/auth/login"));
const SignupPage = lazy(() => import("../../pages/auth/signup"));
const NotFoundPage = lazy(() => import("../../pages/not-found"));

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
      {
        path: "dashboard",
        element: withSuspense(
          <AuthGuard>
            <DashboardPage />
          </AuthGuard>
        ),
      },
      {
        path: "profile",
        element: withSuspense(
          <AuthGuard>
            <ProfilePage />
          </AuthGuard>
        ),
      },
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
