import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { cn } from "~/lib/utils";

/**
 * Composer workspace/branch trigger adapted from pinned MonoCode donor
 * `src/features/source-control/ui/GitPickerTrigger.tsx`
 * (bb3924b61f4d48ba12327ee1eb70a8b83d95e51d).
 *
 * Donor trigger: `-ml-1.5 h-6 max-w-64 gap-1.5 rounded-md px-1.5 12px
 * content/55`, icon `size-3.5`, no chevron, hover/expanded `bg-content/8`.
 * T3 owns open behavior, so callers keep their Base UI trigger primitives
 * styled with these classes (or render this plain button where no primitive
 * is required). Tauri branch/worktree stores are not imported.
 */
export function composerPickerTriggerClassName(className?: string): string {
  // shrink-0 + min-w-fit are a T3-strip necessity, not donor chrome: the
  // composer context strip squeezes flex items, which collapses truncate
  // labels to ~1 char ("m..."). Donor reference shows natural-width triggers
  // (workspace ~122px, branch ~60px), so triggers must claim content width.
  return cn(
    "monocode-surface -ml-1.5 flex h-6 min-w-fit max-w-64 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[12px] text-content/55 hover:bg-content/8 hover:text-content aria-expanded:bg-content/8 aria-expanded:text-content disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-content/55 active:scale-[0.97]",
    className,
  );
}

type Props = Omit<ComponentPropsWithoutRef<"button">, "children" | "className"> & {
  icon: ReactNode;
  label: ReactNode;
  loading?: boolean;
  className?: string;
};

/** Plain-button donor trigger for surfaces that do not need a picker primitive. */
export function ComposerPickerTrigger({
  icon,
  label,
  loading = false,
  className,
  ...props
}: Props) {
  return (
    <button type="button" {...props} className={composerPickerTriggerClassName(className)}>
      {icon}
      <span className="relative truncate">
        {loading ? (
          <>
            {/* Reserve the same line box while the value loads. */}
            <span className="invisible">main</span>
            <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-current opacity-50" />
          </>
        ) : (
          label
        )}
      </span>
    </button>
  );
}
