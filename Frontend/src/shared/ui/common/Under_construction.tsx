import "./UnderConstruction.css";

type UnderConstructionProps = {
  sizePx?: number;
  className?: string;
};

export default function UnderConstruction({
  sizePx = 7,
  className,
}: UnderConstructionProps) {
  const classes = ["p-12", className].filter(Boolean).join(" ");
  return (
    <div className={classes}>
      <div
        className="construction"
        style={{ ["--pixel-size" as any]: `${sizePx}px` }}
        aria-label="Under construction animation"
      />
    </div>
  );
}

