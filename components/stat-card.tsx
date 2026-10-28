import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
}) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <div className="flex items-center gap-1.5 text-[12px] text-ink-soft">
        <Icon size={14} strokeWidth={1.8} className="text-accent/70" />
        {label}
      </div>
      <div className="display-nums mt-1.5 font-display text-[30px] leading-none text-ink">
        {value}
      </div>
      {hint ? (
        <p className="mt-1.5 text-[11px] text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}
