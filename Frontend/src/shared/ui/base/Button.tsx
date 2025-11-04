import type { ButtonHTMLAttributes } from "react";

export type BaseButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export function Button(props: BaseButtonProps) {
  return (
    <button
      {...props}
      className={`px-3 py-2 rounded border border-transparent bg-neutral-800 text-white hover:opacity-90 ${props.className ?? ""}`}
    />
  );
}
