import type { ComponentProps } from "react";

/** MonoCode Sidebar.tsx SessionCard frame at bb3924b; T3 supplies state/actions. */
export function SessionCard({
  active,
  selected,
  needsApproval,
  className = "",
  children,
  ...props
}: ComponentProps<"div"> & {
  active: boolean;
  selected: boolean;
  needsApproval: boolean;
}) {
  return (
    <div
      {...props}
      role="button"
      tabIndex={0}
      aria-current={active ? "true" : undefined}
      aria-pressed={selected}
      data-session-selected={selected ? "true" : undefined}
      className={`relative border flex w-full cursor-default select-none touch-none flex-col rounded-md px-2.5 text-left py-2 outline-none focus-visible:ring-1 focus-visible:ring-monocode-accent/50 ${
        selected
          ? "bg-monocode-accent/15 text-content border-transparent"
          : needsApproval
            ? "bg-content/20 text-content border-content/30 border-dashed"
            : active
              ? "bg-selection text-content border-transparent"
              : "text-content/80 hover:text-content border-transparent hover:bg-content/5"
      } ${className}`}
    >
      {children}
    </div>
  );
}
