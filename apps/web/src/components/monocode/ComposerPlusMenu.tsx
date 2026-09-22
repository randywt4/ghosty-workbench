import { useRef, useState } from "react";
import { Popover } from "./Popover";
import { AiIdea, Check, FilePlus, Plus } from "./icons";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

// Plus-menu transplant from MonoCode bb3924b Composer.tsx (ToolButton +
// data-composer-plus Popover). T3 owns upload plumbing, plan/build state and
// focus; the donor owns trigger/menu visuals. Donor rows without a T3
// equivalent (Orchestrator, Draft) are omitted, not reinvented.

export function ComposerPlusMenu(props: {
  uploadDisabled?: boolean;
  uploadHint?: string;
  onUploadFile: () => void;
  /** Plan/build toggle. Null when T3 hides it (plan UI disabled). */
  plan?: { selected: boolean; onToggle: () => void } | null;
  onFocusComposer: () => void;
}) {
  const [plusOpen, setPlusOpen] = useState(false);
  const plusRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={plusRef} className="monocode-surface relative shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="Add files or choose a mode"
              aria-expanded={plusOpen}
              aria-haspopup="menu"
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => setPlusOpen((open) => !open)}
              className={cn(
                "grid size-6.5 shrink-0 cursor-pointer place-items-center rounded-md",
                plusOpen
                  ? "bg-selection-emphasis text-content"
                  : "bg-selection text-content/50 hover:bg-selection-hover hover:text-content",
              )}
            />
          }
        >
          <Plus className="size-3.5" strokeWidth={1.5} />
        </TooltipTrigger>
        <TooltipPopup>Add files or choose a mode</TooltipPopup>
      </Tooltip>
      {plusOpen ? (
        <Popover
          anchor={plusRef}
          side="top"
          align="start"
          width={250}
          autoFocus
          tabIndex={-1}
          role="menu"
          aria-label="Add to message"
          data-chat-composer-floating-layer="true"
          onDismiss={(reason) => {
            setPlusOpen(false);
            if (reason === "escape") props.onFocusComposer();
          }}
          onKeyDown={(event) => {
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const rows = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
            );
            const index = rows.indexOf(document.activeElement as HTMLButtonElement);
            const next =
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? rows.length - 1
                  : event.key === "ArrowDown"
                    ? (index + 1) % rows.length
                    : index <= 0
                      ? rows.length - 1
                      : index - 1;
            rows[next]?.focus();
          }}
          data-composer-plus
          className="p-1.5"
        >
          <p className="px-2 pt-0.5 pb-1 text-[10px] font-medium tracking-wide text-content/40 uppercase">
            Add to message
          </p>
          <button
            type="button"
            role="menuitem"
            disabled={props.uploadDisabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setPlusOpen(false);
              props.onUploadFile();
              props.onFocusComposer();
            }}
            className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-content hover:bg-content/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FilePlus className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-[13px]">Upload file</span>
              <span className="block truncate text-[11px] leading-4 whitespace-nowrap text-content/45">
                {props.uploadHint ?? "Attach files or images"}
              </span>
            </span>
          </button>
          {props.plan ? (
            <button
              type="button"
              role="menuitemcheckbox"
              aria-checked={props.plan.selected}
              aria-pressed={props.plan.selected}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                props.plan?.onToggle();
                setPlusOpen(false);
                props.onFocusComposer();
              }}
              className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left text-content hover:bg-content/10"
            >
              <AiIdea className="mt-0.5 size-4 shrink-0 text-yellow-300/80" />
              <span className="min-w-0 flex-1">
                <span className="block text-[13px]">Plan mode</span>
                <span className="block truncate text-[11px] leading-4 whitespace-nowrap text-content/45">
                  Review a plan before building
                </span>
              </span>
              {props.plan.selected ? (
                <Check className="mt-0.5 size-3.5 shrink-0 text-monocode-accent" />
              ) : null}
            </button>
          ) : null}
        </Popover>
      ) : null}
    </div>
  );
}
