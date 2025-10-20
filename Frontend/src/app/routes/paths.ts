export const paths = {
  home: "/",
  iTicket: "/i-ticket",
  auth: {
    root: "/auth",
    login: "/auth/login",
    signup: "/auth/signup",
  },
  booking: {
    root: "/booking",
    selectVenue: "/booking/select-venue",
    selectSeat: "/booking/select-seat",
    price: "/booking/price",
    payment: "/booking/payment",
    waiting: "/booking/waiting",
    stepOne: "/booking/step-01",
  },
  dashboard: "/dashboard",
  profile: "/profile",
  notFound: "*",
} as const;
