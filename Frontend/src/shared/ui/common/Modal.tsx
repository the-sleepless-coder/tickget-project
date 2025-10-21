import { useEffect } from "react";
import type { ReactNode } from "react";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
};

export function Modal({ open, onClose, title, footer, children }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative bg-white rounded-xl shadow-lg w-[708px] h-[465px] flex flex-col">
        <div className="flex items-center justify-between h-[50px] px-6 border-b bg-white rounded-t-xl flex-shrink-0">
          <h3 className="text-lg font-bold">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="모달 닫기"
            className="text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <div className="px-6 py-3 h-[365px] overflow-y-auto">{children}</div>
        {footer ? (
          <div className="h-[50px] px-6 border-t bg-[rgb(244,246,249)] rounded-b-xl flex-shrink-0">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
