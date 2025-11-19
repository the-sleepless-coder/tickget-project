import type { ConfirmOptions } from "../hooks/useConfirm";

type ConfirmHandler = (
  message: string,
  options?: ConfirmOptions
) => Promise<boolean>;

let globalConfirmHandler: ConfirmHandler | null = null;

export const setGlobalConfirm = (handler: ConfirmHandler) => {
  globalConfirmHandler = handler;
};

export const showConfirm = (
  message: string,
  options?: ConfirmOptions
): Promise<boolean> => {
  if (globalConfirmHandler) {
    return globalConfirmHandler(message, options);
  }

  // fallback to native confirm (wrapped in Promise)
  const result = window.confirm(message);
  return Promise.resolve(result);
};
