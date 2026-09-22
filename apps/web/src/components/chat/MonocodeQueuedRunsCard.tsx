// Queue-only donor visual ported from MonoCode Composer.tsx MessageQueue
// (bb3924b overlay excerpt, lines 258-422): top-attached queue card, ListEnd
// rows, Steer / edit / delete actions, and the paused strip with resume.
// T3 owns all behavior behind it: server commands, capabilities, queue state,
// optimistic rows, busy/disabled states, attachment recovery (edit loads the
// draft back into the composer, so there is no donor-style inline textarea),
// and keyboard handling. Rendered WITHOUT ComposerBanner wrappers: the donor
// card sits directly above the composer box with no T3 glass overlay and no
// attachment-overlap negative margin. Requires the ChatComposer mount move
// (queue out of ComposerBanner.Dock, directly above the composer-box sibling).
import type { ComponentProps, ReactNode } from "react";

import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

import { cn } from "~/lib/utils";
import {
  ChevronDown,
  Clock,
  CornerDownRight,
  GripVertical,
  ListEnd,
  Pause,
  Pencil,
  Play,
  Trash2,
} from "../monocode/icons";

const iconActionClass =
  "grid size-6 shrink-0 place-items-center rounded-md hover:bg-content/10 hover:text-content disabled:opacity-40 disabled:hover:bg-transparent";

const textActionClass =
  "flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 hover:bg-content/10 hover:text-content disabled:opacity-40 disabled:hover:bg-transparent";

/** Donor outer: `px-2 text-content/55` + data-message-queue. */
export function MonocodeQueueShell({ className, ...props }: ComponentProps<"div">) {
  return <div data-message-queue {...props} className={cn("px-2", className)} />;
}

/**
 * Donor card: `rounded-t-[10px] border border-b-0 border-content/10
 * bg-content/3 px-2 py-1`. The monocode-surface scope supplies the donor
 * tokens; base-ink utilities live on the rows below, never on the same
 * element as the scope (unlayered scope color would win over the utility).
 */
export function MonocodeQueueCard({
  paused,
  resumeDisabled,
  onResume,
  children,
}: {
  readonly paused: boolean;
  readonly resumeDisabled: boolean;
  readonly onResume: () => void;
  readonly children: ReactNode;
}) {
  return (
    <div className="monocode-surface">
      <div
        data-message-queue-card
        className="relative z-0 rounded-t-[10px] border border-b-0 border-content/10 bg-content/3 px-2 py-1"
      >
        {paused ? (
          <div className="flex h-7 items-center gap-2 border-b border-stroke text-[12px] text-content/55">
            <Pause className="size-3.5 shrink-0" aria-hidden />
            {/* T3-accurate copy: the hold follows a restart, not an interrupt. */}
            <span className="min-w-0 flex-1 truncate">Queue held after restart</span>
            <button
              type="button"
              aria-label="Resume queue"
              disabled={resumeDisabled}
              onClick={onResume}
              className={textActionClass}
            >
              <Play className="size-3.5" aria-hidden />
              Resume
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}

/**
 * Retained T3 collapse toggle as a compact donor-style header row: count plus
 * chevron, no banner chrome. The border separates the header from the list
 * only while expanded.
 */
export function MonocodeQueueHeaderToggle({
  expanded,
  count,
  controlsId,
  onToggle,
}: {
  readonly expanded: boolean;
  readonly count: number;
  readonly controlsId: string;
  readonly onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={expanded ? "Collapse queued messages" : "Expand queued messages"}
      aria-expanded={expanded}
      aria-controls={controlsId}
      onPointerDown={(event) => event.preventDefault()}
      onClick={onToggle}
      className={cn(
        "flex h-7 w-full items-center gap-2 text-left text-[12px] text-content/55 hover:text-content",
        expanded && "border-b border-stroke",
      )}
    >
      <ChevronDown className={cn("size-3.5 shrink-0", !expanded && "rotate-180")} aria-hidden />
      <span className="min-w-0 flex-1 truncate">Queued</span>
      <span className="shrink-0 tabular-nums">{count}</span>
    </button>
  );
}

/** Donor row: `flex min-h-7 items-center gap-2 text-[12px]` + dividers. */
export function MonocodeQueueRow({
  divider,
  dimmed,
  editing,
  indicator,
  className,
  children,
  ...props
}: ComponentProps<"li"> & {
  readonly divider?: boolean;
  readonly dimmed?: boolean;
  readonly editing?: boolean;
  readonly indicator?: "top" | "bottom" | null;
}) {
  return (
    <li
      {...props}
      className={cn(
        "relative flex min-h-7 items-center gap-2 text-[12px] text-content/55",
        divider && "border-t border-stroke",
        // Retained T3 live-drag state; the donor has no reorder UI.
        dimmed && "opacity-50",
        // The donor has no edit-in-composer state; donor selection token marks it.
        editing && "bg-selection",
        className,
      )}
    >
      {indicator === "top" ? (
        // Retained T3 drop-target indicator token.
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-0.5 rounded bg-primary/70"
        />
      ) : null}
      {children}
      {indicator === "bottom" ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 rounded bg-primary/70"
        />
      ) : null}
    </li>
  );
}

export function MonocodeQueueRowIcon() {
  return <ListEnd className="size-3.5 shrink-0" aria-hidden />;
}

/** Retained T3 grip reorder (ArrowUp/Down) restyled as a donor icon button. */
export function MonocodeQueueGripButton({
  disabled,
  onArm,
  onMoveUp,
  onMoveDown,
}: {
  readonly disabled: boolean;
  readonly onArm: () => void;
  readonly onMoveUp: () => void;
  readonly onMoveDown: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="Reorder queued message (drag, or press the arrow keys)"
      disabled={disabled}
      onPointerDown={onArm}
      onKeyDown={(event) => {
        if (event.key === "ArrowUp") {
          event.preventDefault();
          onMoveUp();
        }
        if (event.key === "ArrowDown") {
          event.preventDefault();
          onMoveDown();
        }
      }}
      className={cn(iconActionClass, "cursor-grab active:cursor-grabbing disabled:cursor-default")}
    >
      <GripVertical className="size-3.5" aria-hidden />
    </button>
  );
}

/** Retained T3 saving state; the donor has no optimistic-row concept. */
export function MonocodeQueuePendingMark() {
  return <Clock aria-label="Saving queued message" className="size-3 shrink-0" aria-hidden />;
}

/** Donor label: `min-w-0 flex-1 truncate text-content/80`. */
export function MonocodeQueueLabel({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={<span className="min-w-0 flex-1 truncate text-content/80" />}>
        {children}
      </TooltipTrigger>
      <TooltipPopup>{title}</TooltipPopup>
    </Tooltip>
  );
}

export function MonocodeQueueEditButton({
  disabled,
  title,
  onPress,
}: {
  readonly disabled: boolean;
  readonly title: string;
  readonly onPress: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Edit queued message"
            disabled={disabled}
            onClick={onPress}
            className={iconActionClass}
          />
        }
      >
        {" "}
        <Pencil className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipPopup>{title}</TooltipPopup>
    </Tooltip>
  );
}

/** Donor Steer button with CornerDownRight. */
export function MonocodeQueueSteerButton({
  disabled,
  title,
  onPress,
}: {
  readonly disabled: boolean;
  readonly title: string;
  readonly onPress: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button type="button" disabled={disabled} onClick={onPress} className={textActionClass} />
        }
      >
        {" "}
        <CornerDownRight className="size-3.5" aria-hidden />
        Steer
      </TooltipTrigger>
      <TooltipPopup>{title}</TooltipPopup>
    </Tooltip>
  );
}

export function MonocodeQueueRemoveButton({
  disabled,
  onPress,
}: {
  readonly disabled: boolean;
  readonly onPress: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Remove queued message"
            disabled={disabled}
            onClick={onPress}
            className={iconActionClass}
          />
        }
      >
        {" "}
        <Trash2 className="size-3.5" aria-hidden />
      </TooltipTrigger>
      <TooltipPopup>Remove from queue</TooltipPopup>
    </Tooltip>
  );
}

/** Retained T3 cancel-edit-while-draft-in-composer action, donor-styled. */
export function MonocodeQueueCancelEditButton({ onCancel }: { readonly onCancel: () => void }) {
  return (
    <button
      type="button"
      aria-label="Cancel editing queued message"
      onClick={onCancel}
      className={textActionClass}
    >
      Cancel
    </button>
  );
}
