/* MonoCode SessionFiltersMenu.tsx at bb3924b; shared option rows. */
import type { ReactNode } from "react";
import { Check } from "./icons";

export function SectionLabel({ children }: { children: string }) {
  return (
    <div className="px-2 pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-content/40">
      {children}
    </div>
  );
}

export function FilterItem({
  label,
  checked,
  icon,
  onClick,
  disabled = false,
  role = "menuitemcheckbox",
  description,
  hint,
}: {
  label: string;
  checked: boolean;
  icon?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  role?: "menuitemcheckbox" | "menuitemradio";
  description?: string | undefined;
  hint?: string | undefined;
}) {
  return (
    <button
      type="button"
      role={role}
      disabled={disabled}
      aria-checked={checked}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className="flex min-h-7 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] leading-none text-content hover:bg-content/5 focus-visible:bg-content/5 focus-visible:outline-none disabled:opacity-40 disabled:hover:bg-transparent"
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block truncate leading-label">{label}</span>
        {description ? (
          <span className="mt-1 block text-[11px] leading-snug text-content/50">{description}</span>
        ) : null}
      </span>
      {hint ? <span className="text-[10px] text-content/40">{hint}</span> : null}
      {checked ? <Check className="size-3.5 shrink-0" strokeWidth={2.25} /> : null}
    </button>
  );
}
