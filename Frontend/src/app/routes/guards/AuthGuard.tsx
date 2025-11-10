import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { paths } from "../paths";

type Props = { children: ReactNode };

export default function AuthGuard({ children }: Props) {
  const isAuthed = Boolean(localStorage.getItem("token"));
  const location = useLocation();

  if (!isAuthed) {
    return (
      <Navigate to={paths.auth.login} replace state={{ from: location }} />
    );
  }
  return children;
}
