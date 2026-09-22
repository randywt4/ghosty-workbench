import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import type { RuntimeMode } from "@t3tools/contracts";
import { Popover } from "./Popover";
import { ChevronDown, Lock, LockOpen, Pencil, Sparkles, type IconComponent } from "./icons";
import { runtimeModeConfig } from "../chat/runtimeModeConfig";
import { cn } from "~/lib/utils";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

// AccessPicker copied from MonoCode bb3924b
// (src/features/sessions/ui/AccessPicker.tsx), adapted to T3 runtime modes.
// T3 owns the mode list (compatibleRuntimeModeOptions), persistence, routing
// and submission; only the trigger/menu visuals follow the donor.

const MENU_WIDTH = 288;

const ICONS: Record<RuntimeMode, IconComponent> = {
  "approval-required": Lock,
  "auto-accept-edits": Pencil,
  auto: Sparkles,
  "full-access": LockOpen,
};

export function ComposerAccessPicker(props: {
  value: RuntimeMode;
  /** Compatible modes in display order (T3 may lock this per thread). */
  options: ReadonlyArray<RuntimeMode>;
  busy?: boolean;
  onChange: (mode: RuntimeMode) => void;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(() => Math.max(0, props.options.indexOf(props.value)));
  const root = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(props.onClose);
  onCloseRef.current = props.onClose;
  const optionsRef = useRef(props.options);
  optionsRef.current = props.options;
  const Icon = ICONS[props.value];
  const label = runtimeModeConfig[props.value].label;
  const hint = runtimeModeConfig[props.value].description;

  const dismiss = (restore: boolean) => {
    setOpen(false);
    if (restore) onCloseRef.current?.();
  };

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, optionsRef.current.indexOf(props.value)));
  }, [open, props.value]);

  const pick = (mode: RuntimeMode) => {
    props.onChange(mode);
    dismiss(true);
  };

  const onMenuKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(optionsRef.current.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const mode = optionsRef.current[active];
      if (mode) pick(mode);
    }
  };

  return (
    <div ref={root} className="monocode-surface relative shrink-0">
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={label}
              aria-expanded={open}
              aria-haspopup="listbox"
              data-composer-shortcut="composer.mode"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (open) {
                  dismiss(true);
                  return;
                }
                setOpen(true);
              }}
              className={cn(
                "flex h-6.5 max-w-52 items-center gap-1 rounded-md px-1.5",
                open
                  ? "bg-selection text-content"
                  : "bg-selection text-content hover:bg-selection-hover",
              )}
            />
          }
        >
          <Icon className="size-3.5 shrink-0" strokeWidth={1.75} />
          <span className="min-w-0 truncate text-[11px]" data-composer-control-label>
            {label}
          </span>
          <ChevronDown
            className={cn("size-3 shrink-0 text-content/50", open && "rotate-180")}
            strokeWidth={1.75}
            data-composer-control-chevron
          />
        </TooltipTrigger>
        <TooltipPopup>{`${hint}${props.busy ? " Changes apply to the next turn." : ""}`}</TooltipPopup>
      </Tooltip>
      {open ? (
        <Popover
          data-chat-composer-floating-layer="true"
          anchor={root}
          side="top"
          width={MENU_WIDTH}
          autoFocus
          onDismiss={(reason) => dismiss(reason === "escape")}
          role="listbox"
          aria-label="Access"
          data-access-picker
          tabIndex={-1}
          onKeyDown={onMenuKey}
          className="p-1"
        >
          {props.options.map((mode, index) => {
            const ModeIcon = ICONS[mode];
            const selected = mode === props.value;
            const highlighted = index === active;
            return (
              <button
                key={mode}
                type="button"
                role="option"
                aria-selected={selected}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActive(index)}
                onClick={() => pick(mode)}
                className={cn(
                  "flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left",
                  highlighted || selected
                    ? "bg-selection text-content"
                    : "text-content hover:bg-content/5",
                )}
              >
                <ModeIcon className="mt-0.5 size-3.5 shrink-0 text-content/70" strokeWidth={1.75} />
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium leading-5">
                    {runtimeModeConfig[mode].label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-4 text-content/50">
                    {runtimeModeConfig[mode].description}
                  </span>
                </span>
              </button>
            );
          })}
          {props.busy ? (
            <p className="px-2 py-1.5 text-[11px] leading-4 text-content/50">
              Access changes apply to the next turn. Stop and resend to apply them now.
            </p>
          ) : null}
        </Popover>
      ) : null}
    </div>
  );
}
