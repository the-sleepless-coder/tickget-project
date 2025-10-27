export const paths = {
  home: "/",
  iTicket: "/i-ticket",
  rooms: "/rooms",
  auth: {
    root: "/auth",
    login: "/auth/login",
    signup: "/auth/signup",
  },
  booking: {
    root: "/booking",
    selectVenue: "/booking/select-venue",
    selectSeat: "/booking/select-seat",
    selectSchedule: "/booking/select-schedule",
    price: "/booking/price",
    orderConfirm: "/booking/order-confirm",
    cancelFee: "/booking/cancel-fee",
    complete: "/booking/complete",
    payment: "/booking/payment",
    waiting: "/booking/waiting",
  },
  mypage: {
    root: "/mypage",
    reservations: "/mypage/reservations",
  },
  dashboard: "/dashboard",
  profile: "/profile",
  notFound: "*",
} as const;
