import { useEffect } from "react";
import { useAlert } from "../hooks/useAlert";
import { setGlobalAlert } from "../utils/alert";
import { useConfirm } from "../hooks/useConfirm";
import { setGlobalConfirm } from "../utils/confirm";

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const { showAlert, AlertComponent } = useAlert();
  const { showConfirm, ConfirmComponent } = useConfirm();

  useEffect(() => {
    // 전역 alert 함수 설정
    setGlobalAlert(showAlert);
  }, [showAlert]);

  useEffect(() => {
    setGlobalConfirm(showConfirm);
  }, [showConfirm]);

  return (
    <>
      {children}
      {AlertComponent}
      {ConfirmComponent}
    </>
  );
}
