import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  ANTIGRAVITY_DEFAULT_MODEL,
  type ProviderInstanceId,
  type ProviderDriverKind,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { memo, useMemo, useRef, useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { Badge } from "../ui/badge";
import { buttonVariants } from "../ui/button";
import { cn } from "~/lib/utils";
import { ChevronDown } from "../monocode/icons";
import { Popover } from "../monocode/Popover";
import { ComposerModelMenu } from "../monocode/ComposerModelMenu";
import { ProviderInstanceIcon } from "./ProviderInstanceIcon";
import { shouldShowInstanceBadge, type ProviderInstanceEntry } from "../../providerInstances";
import {
  ModelEsque,
  getTriggerDisplayModelLabel,
  getTriggerDisplayModelName,
} from "./providerIconUtils";
import { resolveModelPickerSelectedModel } from "./ModelPickerContent";
import type { ComposerControlSize } from "./ComposerControl";
import { useComposerHandleContext } from "../../composerHandleContext";
import { shortcutLabelForCommand } from "../../keybindings";

export const ProviderModelPicker = memo(function ProviderModelPicker(props: {
  /**
   * The instance currently selected in the composer. Drives the trigger
   * icon, label and the default-highlighted combobox row.
   */
  activeInstanceId: ProviderInstanceId;
  model: string;
  selectedModels?: ReadonlyArray<{ instanceId: ProviderInstanceId; model: string }>;
  onToggleModel?: (instanceId: ProviderInstanceId, model: string) => void;
  lockedProvider: ProviderDriverKind | null;
  lockedContinuationGroupKey?: string | null;
  /** Instance entries rendered in the sidebar + used to resolve display name. */
  instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  keybindings?: ResolvedKeybindingsConfig;
  modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
  activeProviderIconClassName?: string;
  instanceIndicatorBackground?: string;
  size?: ComposerControlSize;
  compact?: boolean;
  isComposerOwned?: boolean;
  disabled?: boolean;
  terminalOpen?: boolean;
  open?: boolean;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
  /** Aggregate settings can show a neutral value without claiming one provider is selected. */
  triggerLabel?: string;
  triggerAriaLabel?: string;
  onOpenChange?: (open: boolean) => void;
  onOpenProviderSetup?: (instanceId: ProviderInstanceId) => void;
  getModelDisabledReason?: (instanceId: ProviderInstanceId, model: string) => string | null;
  onInstanceModelChange: (instanceId: ProviderInstanceId, model: string) => void;
}) {
  const composerRef = useComposerHandleContext();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [uncontrolledIsMenuOpen, setUncontrolledIsMenuOpen] = useState(false);
  const isMenuOpen = props.open ?? uncontrolledIsMenuOpen;
  const size = props.size ?? "sm";

  // Resolve the active instance entry by exact routing key. The composer
  // resolves fallbacks before rendering this component; if the selected
  // instance disappears, do not infer a replacement from its driver kind.
  const activeEntry = useMemo(() => {
    return (
      props.instanceEntries.find((entry) => entry.instanceId === props.activeInstanceId) ?? null
    );
  }, [props.activeInstanceId, props.instanceEntries]);

  const activeInstanceId = props.activeInstanceId;
  const selectedInstanceOptions = props.modelOptionsByInstance.get(activeInstanceId) ?? [];
  // Account-specific catalogs must keep the selected model label while unavailable.
  const selectedModel =
    resolveModelPickerSelectedModel({
      driverKind: activeEntry?.driverKind,
      model: props.model,
      options: selectedInstanceOptions,
    }) ??
    (activeEntry?.driverKind === "opencode" || activeEntry?.driverKind === "antigravity"
      ? undefined
      : selectedInstanceOptions[0]);
  const triggerTitle = selectedModel
    ? getTriggerDisplayModelName(selectedModel)
    : props.model === ANTIGRAVITY_DEFAULT_MODEL
      ? "Choose model"
      : props.model || "Choose model";
  const triggerLabel = selectedModel
    ? `${getTriggerDisplayModelLabel(selectedModel)}${selectedModel.isUnavailable ? " (Unavailable)" : ""}`
    : triggerTitle;
  const showInstanceBadge =
    activeEntry !== null && shouldShowInstanceBadge(activeEntry, props.instanceEntries);

  const setIsMenuOpen = (open: boolean) => {
    props.onOpenChange?.(open);
    if (props.open === undefined) {
      setUncontrolledIsMenuOpen(open);
    }
  };

  // Donor dismiss semantics: Escape restores focus (editor when composer-owned,
  // trigger otherwise); outside clicks just close. Base UI popovers used to
  // return focus to the trigger; the composer editor is the T3-correct target.
  const restoreFocusAfterDismiss = () => {
    if (props.isComposerOwned) {
      composerRef?.current?.focusAtEnd();
    } else {
      triggerRef.current?.focus();
    }
  };

  const handleInstanceModelChange = (instanceId: ProviderInstanceId, model: string) => {
    if (props.disabled) return;
    props.onInstanceModelChange(instanceId, model);
    setIsMenuOpen(false);
    restoreFocusAfterDismiss();
  };

  const handleRequestClose = () => {
    setIsMenuOpen(false);
    restoreFocusAfterDismiss();
  };

  const shortcutLabel = props.keybindings
    ? shortcutLabelForCommand(props.keybindings, "modelPicker.toggle")
    : null;
  const selectedEntries = props.selectedModels?.map((selection) => {
    const entry = props.instanceEntries.find(
      (candidate) => candidate.instanceId === selection.instanceId,
    );
    const model = resolveModelPickerSelectedModel({
      driverKind: entry?.driverKind,
      model: selection.model,
      options: props.modelOptionsByInstance.get(selection.instanceId) ?? [],
    });
    return {
      ...selection,
      entry,
      label: model
        ? `${getTriggerDisplayModelName(model)}${model.isUnavailable ? " (Unavailable)" : ""}`
        : selection.model,
    };
  });
  const multipleLabel = selectedEntries
    ? selectedEntries.length === 0
      ? "Choose models"
      : `${selectedEntries
          .slice(0, 2)
          .map((selection) => selection.label)
          .join(", ")}${selectedEntries.length > 2 ? `, ${selectedEntries.length - 2} more` : ""}`
    : undefined;
  const allModelNames = selectedEntries
    ? selectedEntries.map((selection) => selection.label).join(", ") || "Choose models"
    : undefined;
  const triggerTooltipContent = shortcutLabel
    ? `${props.triggerLabel ?? allModelNames ?? triggerLabel} · ${shortcutLabel}`
    : (props.triggerLabel ?? allModelNames ?? triggerLabel);

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              ref={triggerRef}
              type="button"
              aria-label={props.triggerAriaLabel ?? allModelNames}
              aria-expanded={isMenuOpen}
              aria-haspopup="dialog"
              data-chat-provider-model-picker="true"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                if (props.disabled) {
                  setIsMenuOpen(false);
                  return;
                }
                setIsMenuOpen(!isMenuOpen);
              }}
              disabled={props.disabled}
              className={cn(
                "monocode-surface flex h-6.5 max-w-40 items-center gap-1 rounded-md px-1.5",
                isMenuOpen
                  ? "bg-selection text-content"
                  : "bg-selection text-content hover:bg-selection-hover",
                props.compact
                  ? "max-w-42 shrink-0"
                  : !props.isComposerOwned && "max-w-48 sm:max-w-56",
                props.triggerClassName,
              )}
            >
              <span className="flex min-w-0 flex-1 items-center gap-1.5">
                {selectedEntries && props.triggerLabel === undefined ? (
                  <span className="flex shrink-0 items-center -space-x-1" aria-hidden="true">
                    {selectedEntries
                      .slice(0, 3)
                      .map((selection) =>
                        selection.entry ? (
                          <ProviderInstanceIcon
                            key={`${selection.instanceId}:${selection.model}`}
                            driverKind={selection.entry.driverKind}
                            displayName={selection.entry.displayName}
                            accentColor={selection.entry.accentColor}
                            className="size-4 rounded-full bg-[var(--chat-composer-glass-surface,var(--background))] ring-2 ring-[var(--chat-composer-glass-surface,var(--background))]"
                            iconClassName="size-4"
                          />
                        ) : null,
                      )}
                    {selectedEntries.length > 3 ? (
                      <span className="relative z-30 flex size-4 items-center justify-center rounded-full bg-[var(--chat-composer-glass-surface,var(--background))] text-[9px] ring-2 ring-[var(--chat-composer-glass-surface,var(--background))]">
                        +{selectedEntries.length - 3}
                      </span>
                    ) : null}
                  </span>
                ) : activeEntry && props.triggerLabel === undefined ? (
                  <ProviderInstanceIcon
                    driverKind={activeEntry.driverKind}
                    displayName={activeEntry.displayName}
                    accentColor={activeEntry.accentColor}
                    acpRegistryAgentId={activeEntry.acpRegistryAgentId}
                    acpRegistryIconUrl={activeEntry.acpRegistryIconUrl}
                    showBadge={showInstanceBadge}
                    className="size-4 shrink-0"
                    iconClassName={cn("size-4", props.activeProviderIconClassName)}
                    indicatorBackground={
                      props.instanceIndicatorBackground ?? "var(--contrast-input)"
                    }
                    badgeClassName={cn(
                      "right-[-0.125rem] bottom-[-0.125rem] h-3 min-w-3 px-0.5 text-[7px]",
                      size === "xs" && "shadow-none",
                    )}
                  />
                ) : null}
                <span
                  className="min-w-0 flex-1 truncate text-[11px]"
                  data-chat-provider-model-picker-label="true"
                >
                  {props.triggerLabel ?? multipleLabel ?? triggerTitle}
                </span>
                {selectedModel?.isUnavailable &&
                !selectedEntries &&
                props.triggerLabel === undefined ? (
                  <Badge variant="outline" size="sm">
                    Unavailable
                  </Badge>
                ) : null}
              </span>
              <span aria-hidden="true" className="flex items-center">
                <ChevronDown
                  className={cn("size-3 shrink-0 text-content/50", isMenuOpen && "rotate-180")}
                  strokeWidth={1.75}
                />
              </span>
            </button>
          }
        />
        <TooltipPopup>{triggerTooltipContent}</TooltipPopup>
      </Tooltip>
      {isMenuOpen ? (
        <Popover
          anchor={triggerRef}
          side="top"
          width={400}
          minHeight={360}
          maxHeight={460}
          role="dialog"
          autoFocus
          tabIndex={-1}
          data-chat-composer-floating-layer="true"
          aria-label="Models"
          onDismiss={(reason) => {
            setIsMenuOpen(false);
            if (reason === "escape") restoreFocusAfterDismiss();
          }}
          data-model-picker
          style={{ height: 460 }}
          className="flex min-h-0 overflow-hidden font-sans"
        >
          <ComposerModelMenu
            activeInstanceId={activeInstanceId}
            model={props.model}
            {...(props.selectedModels !== undefined
              ? { selectedModels: props.selectedModels }
              : {})}
            {...(props.onToggleModel
              ? {
                  onToggleModel: (instanceId: ProviderInstanceId, model: string) => {
                    if (!props.disabled) props.onToggleModel?.(instanceId, model);
                  },
                }
              : {})}
            lockedProvider={props.lockedProvider}
            lockedContinuationGroupKey={props.lockedContinuationGroupKey ?? null}
            instanceEntries={props.instanceEntries}
            {...(props.keybindings ? { keybindings: props.keybindings } : {})}
            modelOptionsByInstance={props.modelOptionsByInstance}
            terminalOpen={props.terminalOpen ?? false}
            onRequestClose={handleRequestClose}
            {...(props.onOpenProviderSetup
              ? { onOpenProviderSetup: props.onOpenProviderSetup }
              : {})}
            {...(props.getModelDisabledReason
              ? { getModelDisabledReason: props.getModelDisabledReason }
              : {})}
            onInstanceModelChange={handleInstanceModelChange}
          />
        </Popover>
      ) : null}
    </>
  );
});
