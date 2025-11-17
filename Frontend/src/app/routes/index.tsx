import { createBrowserRouter, Outlet, useRouteError } from "react-router-dom";
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

// 오류 페이지 컴포넌트
function ErrorPage() {
  const error = useRouteError() as Error | undefined;
  const isModuleLoadError =
    error?.message?.includes("Failed to fetch dynamically imported module") ||
    error?.message?.includes("Failed to load module");

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 p-4">
      <div className="max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-xl font-bold text-red-600">
          {isModuleLoadError ? "모듈 로드 오류" : "예기치 않은 오류가 발생했습니다"}
        </h2>
        <p className="mb-4 text-sm text-neutral-600">
          {isModuleLoadError
            ? "페이지를 불러오는 중 문제가 발생했습니다. 네트워크 연결을 확인하고 페이지를 새로고침해주세요."
            : "앱을 사용하는 중 오류가 발생했습니다."}
        </p>
        {error && (
          <details className="mb-4">
            <summary className="cursor-pointer text-xs text-neutral-500">
              오류 상세 정보
            </summary>
            <pre className="mt-2 overflow-auto rounded bg-neutral-100 p-2 text-xs text-neutral-700">
              {error.message}
            </pre>
          </details>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => {
              window.location.reload();
            }}
            className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            페이지 새로고침
          </button>
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="flex-1 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            홈으로 이동
          </button>
        </div>
      </div>
    </div>
  );
}

export const router = createBrowserRouter([
  {
    element: <MainLayout />,
    errorElement: <ErrorPage />,
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
    errorElement: <ErrorPage />,
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
      { path: "game-result", element: withSuspense(<GameResultPage />) },
    ],
  },
  {
    path: "auth",
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "login", element: withSuspense(<LoginPage />) },
      { path: "signup", element: withSuspense(<SignupPage />) },
    ],
  },
  // 백엔드가 /signup/additional-info로 리다이렉트하는 경우를 처리
  {
    path: "signup",
    element: <AuthLayout />,
    errorElement: <ErrorPage />,
    children: [
      { path: "additional-info", element: withSuspense(<SignupPage />) },
    ],
  },
]);
