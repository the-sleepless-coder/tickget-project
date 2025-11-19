import { useState, useCallback, useRef } from "react";
import ConfirmDialog from "../ui/common/ConfirmDialog";
import type { AlertType } from "../ui/common/CustomAlert";

export interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  type?: AlertType;
}

export function useConfirm() {
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    message: string;
    title?: string;
    confirmText?: string;
    cancelText?: string;
    type?: AlertType;
  }>({
    open: false,
    message: "",
    title: "tickget.kr 내용:",
    confirmText: "확인",
    cancelText: "취소",
    type: "warning",
  });

  const resolverRef = useRef<(value: boolean) => void>();

  const showConfirm = useCallback(
    (message: string, options?: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setConfirmState({
          open: true,
          message,
          title: options?.title ?? "tickget.kr 내용:",
          confirmText: options?.confirmText ?? "확인",
          cancelText: options?.cancelText ?? "취소",
          type: options?.type ?? "warning",
        });
      });
    },
    []
  );

  const handleClose = useCallback((result: boolean) => {
    setConfirmState((prev) => ({ ...prev, open: false }));
    resolverRef.current?.(result);
    resolverRef.current = undefined;
  }, []);

  const ConfirmComponent = (
    <ConfirmDialog
      open={confirmState.open}
      title={confirmState.title}
      message={confirmState.message}
      confirmText={confirmState.confirmText}
      cancelText={confirmState.cancelText}
      type={confirmState.type}
      onConfirm={() => handleClose(true)}
      onCancel={() => handleClose(false)}
    />
  );

  return {
    showConfirm,
    ConfirmComponent,
  };
}
