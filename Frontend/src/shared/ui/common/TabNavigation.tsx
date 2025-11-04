interface TabNavigationProps {
  tabs: Array<{ id: string; label: string }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: "primary" | "secondary";
}

export default function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  variant = "secondary",
}: TabNavigationProps) {
  const baseStyles =
    variant === "primary"
      ? "px-6 py-3 text-base font-semibold rounded-t-lg transition-colors"
      : "px-4 py-2 text-sm font-medium rounded-lg transition-colors";

  const activeStyles =
    variant === "primary"
      ? "bg-deep-purple text-white"
      : "bg-purple-600 text-white";

  const inactiveStyles =
    variant === "primary"
      ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
      : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200";

  return (
    <div className="flex flex-nowrap gap-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`${baseStyles} whitespace-nowrap ${
            activeTab === tab.id ? activeStyles : inactiveStyles
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
