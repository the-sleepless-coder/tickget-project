import { useState, useCallback } from "react";
import CustomAlert, { type AlertType } from "../ui/common/CustomAlert";

export interface AlertOptions {
  title?: string;
  type?: AlertType;
  confirmText?: string;
  onConfirm?: () => void;
}

export function useAlert() {
  const [alertState, setAlertState] = useState<{
    open: boolean;
    message: string;
    title?: string;
    type?: AlertType;
    confirmText?: string;
    onConfirm?: () => void;
  }>({
    open: false,
    message: "",
  });

  const showAlert = useCallback((message: string, options?: AlertOptions) => {
    setAlertState({
      open: true,
      message,
      title: options?.title,
      type: options?.type || "info",
      confirmText: options?.confirmText,
      onConfirm: options?.onConfirm,
    });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState((prev) => ({ ...prev, open: false }));
  }, []);

  const AlertComponent = (
    <CustomAlert
      open={alertState.open}
      onClose={hideAlert}
      message={alertState.message}
      title={alertState.title}
      type={alertState.type}
      confirmText={alertState.confirmText}
      onConfirm={alertState.onConfirm}
    />
  );

  return {
    showAlert,
    hideAlert,
    AlertComponent,
  };
}
