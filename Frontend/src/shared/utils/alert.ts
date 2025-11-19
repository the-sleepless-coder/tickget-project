import type { AlertType } from "../ui/common/CustomAlert";

// 전역 alert 함수를 위한 타입
type AlertHandler = (
  message: string,
  options?: {
    title?: string;
    type?: AlertType;
    confirmText?: string;
    onConfirm?: () => void;
  }
) => void;

// 전역 alert 핸들러 저장
let globalAlertHandler: AlertHandler | null = null;

export const setGlobalAlert = (handler: AlertHandler) => {
  globalAlertHandler = handler;
};

export const showAlert = (
  message: string,
  options?: {
    title?: string;
    type?: AlertType;
    confirmText?: string;
    onConfirm?: () => void;
  }
) => {
  if (globalAlertHandler) {
    globalAlertHandler(message, options);
  } else {
    // 폴백: 기본 브라우저 alert
    window.alert(message);
  }
};
