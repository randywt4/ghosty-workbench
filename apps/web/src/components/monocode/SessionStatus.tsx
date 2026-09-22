import type { ThreadStatusPill } from "../Sidebar.logic";
import { Check, CircleAlert, CircleDashed } from "./icons";
import { TerminalSpinner } from "./TerminalSpinner";

/** Donor Sidebar SessionCard status presentation; retain every T3 status. */
export function SessionStatus({ status }: { status: ThreadStatusPill }) {
  const busy =
    status.label === "Working" || status.label === "Connecting" || status.label === "Waiting";
  const needsInput =
    status.label === "Pending Approval" ||
    status.label === "Awaiting Input" ||
    status.label === "Plan Ready";
  const done = status.label === "Completed";
  const color = needsInput
    ? "text-amber-400"
    : busy
      ? "text-monocode-accent"
      : done
        ? "text-emerald-400"
        : "text-content/55";
  return (
    <span className={`flex shrink-0 items-center gap-1 text-[11px] tabular-nums ${color}`}>
      {busy ? (
        <TerminalSpinner className="inline-block w-3 select-none text-center text-[11px] leading-none" />
      ) : needsInput ? (
        <CircleAlert className="size-3" strokeWidth={1.75} />
      ) : done ? (
        <Check className="size-3" strokeWidth={2.25} />
      ) : (
        <CircleDashed className="size-3" strokeWidth={1.75} />
      )}
      <span>{status.label}</span>
    </span>
  );
}
