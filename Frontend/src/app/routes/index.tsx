import { createBrowserRouter } from "react-router-dom";
import { lazy, Suspense } from "react";
import MainLayout from "../layouts/MainLayout";
import AuthLayout from "../layouts/AuthLayout";
import AuthGuard from "./guards/AuthGuard";

const HomePage = lazy(() => import("../../pages/home"));
const BookingIndexPage = lazy(() => import("../../pages/booking"));
const SelectVenuePage = lazy(() => import("../../pages/booking/select-venue"));
const SelectSeatPage = lazy(() => import("../../pages/booking/select-seat"));
const PricePage = lazy(() => import("../../pages/booking/price"));
const PaymentPage = lazy(() => import("../../pages/booking/payment"));
const BookingWaitingPage = lazy(() => import("../../pages/booking/waiting"));
const BookingStepOnePage = lazy(() => import("../../pages/booking/step-01"));
const DashboardPage = lazy(() => import("../../pages/dashboard"));
const ProfilePage = lazy(() => import("../../pages/profile"));
const ITicketPage = lazy(() => import("../../pages/i-ticket/i-ticket"));
const LoginPage = lazy(() => import("../../pages/auth/login"));
const SignupPage = lazy(() => import("../../pages/auth/signup"));
const NotFoundPage = lazy(() => import("../../pages/not-found"));

function withSuspense(el: JSX.Element) {
  return <Suspense fallback={null}>{el}</Suspense>;
}

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      {
        path: "booking",
        element: withSuspense(
          <AuthGuard>
            <BookingIndexPage />
          </AuthGuard>
        ),
        children: [
          { path: "waiting", element: withSuspense(<BookingWaitingPage />) },
          { path: "step-01", element: withSuspense(<BookingStepOnePage />) },
          { path: "select-venue", element: withSuspense(<SelectVenuePage />) },
          { path: "select-seat", element: withSuspense(<SelectSeatPage />) },
          { path: "price", element: withSuspense(<PricePage />) },
          { path: "payment", element: withSuspense(<PaymentPage />) },
        ],
      },
      {
        path: "i-ticket",
        element: withSuspense(<ITicketPage />),
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
  {
    path: "auth",
    element: <AuthLayout />,
    children: [
      { path: "login", element: withSuspense(<LoginPage />) },
      { path: "signup", element: withSuspense(<SignupPage />) },
    ],
  },
]);
