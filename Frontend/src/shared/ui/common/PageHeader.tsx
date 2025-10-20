import { ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
};

export default function PageHeader({ title, subtitle }: Props) {
  return (
    <div className="mb-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle ? (
        <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>
      ) : null}
    </div>
  );
}
