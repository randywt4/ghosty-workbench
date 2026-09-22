import {
  type ProviderDriverKind,
  type ProviderInstanceId,
  type ProviderOptionDescriptor,
  type ProviderOptionSelection,
  type ScopedThreadRef,
  type ServerProviderModel,
} from "@t3tools/contracts";
import {
  applyClaudePromptEffortPrefix,
  buildProviderOptionSelectionsFromDescriptors,
  getProviderOptionCurrentLabel,
  getProviderOptionCurrentValue,
  getProviderOptionDescriptors,
  isClaudeUltrathinkPrompt,
  normalizeModelSlug,
} from "@t3tools/shared/model";
import { memo, useCallback, useRef, type KeyboardEvent } from "react";
import type { VariantProps } from "class-variance-authority";
import { GaugeIcon, ZapIcon } from "lucide-react";
import { Check } from "../monocode/icons";
import { Popover } from "../monocode/Popover";
import { FilterItem, SectionLabel } from "../monocode/FilterControls";
import { useComposerHandleContext } from "../../composerHandleContext";
import { buttonVariants } from "../ui/button";
import {
  MenuGroup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuRadioItemIndicator,
  MenuSeparator as MenuDivider,
} from "../ui/menu";
import { useComposerDraftStore, DraftId } from "../../composerDraftStore";
import { getProviderModelCapabilities } from "../../providerModels";
import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  ComposerControl,
  ComposerControlChevron,
  ComposerControlIcon,
  type ComposerControlSize,
} from "./ComposerControl";
import { useComposerMenuState } from "./useComposerMenuState";

type ProviderOptions = ReadonlyArray<ProviderOptionSelection>;

const SAVED_OPTION_LABELS: Readonly<Record<string, string>> = {
  agent: "Agent",
  effort: "Effort",
  reasoningEffort: "Reasoning effort",
  variant: "Reasoning",
};

function savedOptionLabel(id: string): string {
  return (
    SAVED_OPTION_LABELS[id] ??
    id.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/^./, (character) => character.toUpperCase())
  );
}

/** Read-only descriptors for saved values whose OpenCode model metadata is unavailable. */
export function buildUnavailableModelOptionDescriptors(
  selections: ProviderOptions | null | undefined,
): ReadonlyArray<ProviderOptionDescriptor> {
  return (selections ?? []).map((selection) =>
    typeof selection.value === "boolean"
      ? {
          id: selection.id,
          label: savedOptionLabel(selection.id),
          type: "boolean" as const,
          currentValue: selection.value,
        }
      : {
          id: selection.id,
          label: savedOptionLabel(selection.id),
          type: "select" as const,
          options: [{ id: selection.value, label: selection.value }],
          currentValue: selection.value,
        },
  );
}

type TraitsPersistence =
  | {
      threadRef?: ScopedThreadRef;
      draftId?: DraftId;
      onModelOptionsChange?: never;
    }
  | {
      threadRef?: undefined;
      onModelOptionsChange: (nextOptions: ProviderOptions | undefined) => void;
    };

const ULTRATHINK_PROMPT_PREFIX = "Ultrathink:\n";

export function DefaultBadge() {
  return (
    <Badge
      variant="outline"
      className="inline-flex h-4 w-fit min-w-0 items-center justify-center gap-0 border-border/70 bg-muted/60 px-1.5 py-0 font-semibold text-[10px] text-muted-foreground leading-none sm:h-4"
    >
      Default
    </Badge>
  );
}

function replaceDescriptorCurrentValue(
  descriptors: ReadonlyArray<ProviderOptionDescriptor>,
  descriptorId: string,
  currentValue: string | boolean | undefined,
): ReadonlyArray<ProviderOptionDescriptor> {
  return descriptors.map((descriptor) =>
    descriptor.id !== descriptorId
      ? descriptor
      : descriptor.type === "boolean"
        ? {
            ...descriptor,
            ...(typeof currentValue === "boolean" ? { currentValue } : {}),
          }
        : {
            ...descriptor,
            ...(typeof currentValue === "string" ? { currentValue } : {}),
          },
  );
}

function getDescriptorStringValue(
  descriptor: Extract<ProviderOptionDescriptor, { type: "select" }> | null,
): string | null {
  if (!descriptor) {
    return null;
  }
  const value = getProviderOptionCurrentValue(descriptor);
  return typeof value === "string" ? value : null;
}

function getSelectedTraits(
  provider: ProviderDriverKind,
  models: ReadonlyArray<ServerProviderModel>,
  model: string | null | undefined,
  prompt: string,
  modelOptions: ProviderOptions | null | undefined,
  allowPromptInjectedEffort: boolean,
  planModeEnabled: boolean,
) {
  const caps = getProviderModelCapabilities(models, model, provider, planModeEnabled);
  const modelIsUnavailable =
    provider === "opencode" &&
    !models.some((candidate) => candidate.slug === normalizeModelSlug(model, provider));
  const descriptors = modelIsUnavailable
    ? buildUnavailableModelOptionDescriptors(
        planModeEnabled
          ? modelOptions
          : modelOptions?.filter((option) => option.id !== "agent" || option.value !== "plan"),
      )
    : getProviderOptionDescriptors({
        caps,
        selections: modelOptions,
      });
  const selectDescriptors = descriptors.filter(
    (descriptor): descriptor is Extract<ProviderOptionDescriptor, { type: "select" }> =>
      descriptor.type === "select",
  );
  const booleanDescriptors = descriptors.filter(
    (descriptor): descriptor is Extract<ProviderOptionDescriptor, { type: "boolean" }> =>
      descriptor.type === "boolean",
  );
  const primarySelectDescriptor = selectDescriptors[0] ?? null;
  const contextWindowDescriptor =
    selectDescriptors.find((descriptor) => descriptor.id === "contextWindow") ?? null;
  const agentDescriptor = selectDescriptors.find((descriptor) => descriptor.id === "agent") ?? null;
  const fastModeDescriptor =
    booleanDescriptors.find((descriptor) => descriptor.id === "fastMode") ?? null;
  const thinkingDescriptor =
    booleanDescriptors.find((descriptor) => descriptor.id === "thinking") ?? null;

  // Prompt-controlled effort (e.g. ultrathink in prompt text)
  const ultrathinkPromptControlled =
    allowPromptInjectedEffort &&
    (primarySelectDescriptor?.promptInjectedValues?.length ?? 0) > 0 &&
    isClaudeUltrathinkPrompt(prompt);

  // Check if "ultrathink" appears in the body text (not just our prefix)
  const ultrathinkInBodyText =
    ultrathinkPromptControlled && isClaudeUltrathinkPrompt(prompt.replace(/^Ultrathink:\s*/i, ""));
  const effort =
    (ultrathinkPromptControlled
      ? "ultrathink"
      : getDescriptorStringValue(primarySelectDescriptor)) ?? null;
  const thinkingEnabled =
    typeof thinkingDescriptor?.currentValue === "boolean" ? thinkingDescriptor.currentValue : null;
  const contextWindow = getDescriptorStringValue(contextWindowDescriptor);
  const selectedAgent = getDescriptorStringValue(agentDescriptor);
  const selectedAgentLabel = agentDescriptor
    ? getProviderOptionCurrentLabel(agentDescriptor)
    : null;

  return {
    caps,
    descriptors,
    selectDescriptors,
    booleanDescriptors,
    primarySelectDescriptor,
    contextWindowDescriptor,
    agentDescriptor,
    fastModeDescriptor,
    thinkingDescriptor,
    effort,
    thinkingEnabled,
    contextWindow,
    ultrathinkPromptControlled,
    ultrathinkInBodyText,
    selectedAgent,
    selectedAgentLabel,
    modelIsUnavailable,
  };
}

export function getTraitsSectionVisibility(input: {
  provider: ProviderDriverKind;
  models: ReadonlyArray<ServerProviderModel>;
  model: string | null | undefined;
  prompt: string;
  modelOptions: ProviderOptions | null | undefined;
  allowPromptInjectedEffort?: boolean;
  planModeEnabled: boolean;
}) {
  const selected = getSelectedTraits(
    input.provider,
    input.models,
    input.model,
    input.prompt,
    input.modelOptions,
    input.allowPromptInjectedEffort ?? true,
    input.planModeEnabled,
  );

  const showEffort = selected.primarySelectDescriptor !== null;
  const showThinking = selected.thinkingDescriptor !== null;
  const showFastMode = selected.fastModeDescriptor !== null;
  const showContextWindow = selected.contextWindowDescriptor !== null;
  const showAgent = selected.agentDescriptor !== null;

  return {
    ...selected,
    showEffort,
    showThinking,
    showFastMode,
    showContextWindow,
    showAgent,
    hasAnyControls:
      showEffort ||
      showThinking ||
      showFastMode ||
      showContextWindow ||
      showAgent ||
      (selected.modelIsUnavailable && selected.descriptors.length > 0),
  };
}

export function shouldRenderTraitsControls(input: {
  provider: ProviderDriverKind;
  models: ReadonlyArray<ServerProviderModel>;
  model: string | null | undefined;
  prompt: string;
  modelOptions: ProviderOptions | null | undefined;
  allowPromptInjectedEffort?: boolean;
  planModeEnabled: boolean;
}): boolean {
  return getTraitsSectionVisibility(input).hasAnyControls;
}

export interface TraitsMenuContentProps {
  provider: ProviderDriverKind;
  instanceId?: ProviderInstanceId;
  models: ReadonlyArray<ServerProviderModel>;
  model: string | null | undefined;
  prompt: string;
  onPromptChange: (prompt: string) => void;
  modelOptions?: ProviderOptions | null | undefined;
  allowPromptInjectedEffort?: boolean;
  planModeEnabled: boolean;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
  isComposerOwned?: boolean;
}

export type TraitsSelectionInput = TraitsMenuContentProps & TraitsPersistence;

/**
 * Shared selection state behind every traits surface (the standalone pill
 * menu and the combined model/reasoning root menu). Identical update paths:
 * draft/store persistence, ultrathink prompt injection, descriptor mapping.
 */
export function useTraitsSelection({
  provider,
  instanceId,
  models,
  model,
  prompt,
  onPromptChange,
  modelOptions,
  allowPromptInjectedEffort = true,
  planModeEnabled,
  ...persistence
}: TraitsSelectionInput) {
  const setProviderModelOptions = useComposerDraftStore((store) => store.setProviderModelOptions);
  const updateModelOptions = useCallback(
    (nextOptions: ProviderOptions | undefined) => {
      if ("onModelOptionsChange" in persistence) {
        persistence.onModelOptionsChange(nextOptions);
        return;
      }
      const threadTarget = persistence.threadRef ?? persistence.draftId;
      if (!threadTarget) {
        return;
      }
      setProviderModelOptions(threadTarget, provider, nextOptions, {
        ...(instanceId ? { instanceId } : {}),
        model,
        persistSticky: true,
      });
    },
    [instanceId, model, persistence, provider, setProviderModelOptions],
  );
  const visibility = getTraitsSectionVisibility({
    provider,
    models,
    model,
    prompt,
    modelOptions,
    allowPromptInjectedEffort,
    planModeEnabled,
  });
  const { descriptors, primarySelectDescriptor, ultrathinkPromptControlled, ultrathinkInBodyText } =
    visibility;
  const updateDescriptors = useCallback(
    (nextDescriptors: ReadonlyArray<ProviderOptionDescriptor>) => {
      updateModelOptions(buildProviderOptionSelectionsFromDescriptors(nextDescriptors));
    },
    [updateModelOptions],
  );

  const handleSelectChange = useCallback(
    (descriptor: Extract<ProviderOptionDescriptor, { type: "select" }>, value: string) => {
      if (!value) return;
      if (descriptor.promptInjectedValues?.includes(value)) {
        const nextPrompt =
          prompt.trim().length === 0
            ? ULTRATHINK_PROMPT_PREFIX
            : applyClaudePromptEffortPrefix(prompt, "ultrathink");
        onPromptChange(nextPrompt);
        return;
      }
      if (ultrathinkInBodyText && descriptor.id === primarySelectDescriptor?.id) return;
      if (ultrathinkPromptControlled && descriptor.id === primarySelectDescriptor?.id) {
        const stripped = prompt.replace(/^Ultrathink:\s*/i, "");
        onPromptChange(stripped);
      }
      updateDescriptors(replaceDescriptorCurrentValue(descriptors, descriptor.id, value));
    },
    [
      descriptors,
      onPromptChange,
      primarySelectDescriptor,
      prompt,
      ultrathinkInBodyText,
      ultrathinkPromptControlled,
      updateDescriptors,
    ],
  );

  const setBooleanOption = useCallback(
    (descriptor: Extract<ProviderOptionDescriptor, { type: "boolean" }>, value: boolean) => {
      updateDescriptors(replaceDescriptorCurrentValue(descriptors, descriptor.id, value));
    },
    [descriptors, updateDescriptors],
  );

  return { ...visibility, updateDescriptors, handleSelectChange, setBooleanOption };
}

function navigateTraitsMenu(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  event.stopPropagation();
  const rows = Array.from(
    event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
  );
  if (rows.length === 0) return;
  const current = rows.indexOf(document.activeElement as HTMLButtonElement);
  const next =
    event.key === "Home"
      ? 0
      : event.key === "End"
        ? rows.length - 1
        : event.key === "ArrowDown"
          ? (current + 1) % rows.length
          : current <= 0
            ? rows.length - 1
            : current - 1;
  rows[next]?.focus();
}

function TraitsDonorMenuContent({
  onPick,
  ...props
}: TraitsMenuContentProps & TraitsPersistence & { onPick: () => void }) {
  const selection = useTraitsSelection(props);
  return (
    <>
      {selection.selectDescriptors.map((descriptor) => {
        const promptControlled = descriptor.id === selection.primarySelectDescriptor?.id;
        const disabled =
          selection.modelIsUnavailable || (promptControlled && selection.ultrathinkInBodyText);
        const selected =
          promptControlled && selection.ultrathinkPromptControlled
            ? "ultrathink"
            : getDescriptorStringValue(descriptor);
        return (
          <div key={descriptor.id} role="group" aria-label={descriptor.label}>
            <SectionLabel>{descriptor.label}</SectionLabel>
            {promptControlled && selection.ultrathinkInBodyText ? (
              <p className="px-2 py-1 text-[11px] text-content/50">
                Remove &quot;ultrathink&quot; from your prompt to change this option.
              </p>
            ) : null}
            {descriptor.options.map((option) => (
              <FilterItem
                key={option.id}
                role="menuitemradio"
                label={option.label}
                checked={selected === option.id}
                disabled={disabled}
                description={option.description}
                hint={option.isDefault ? "Default" : undefined}
                onClick={() => {
                  selection.handleSelectChange(descriptor, option.id);
                  onPick();
                }}
              />
            ))}
          </div>
        );
      })}
      {selection.booleanDescriptors.map((descriptor) => (
        <div key={descriptor.id} role="group" aria-label={descriptor.label}>
          <SectionLabel>{descriptor.label}</SectionLabel>
          <FilterItem
            label={descriptor.label}
            checked={descriptor.currentValue === true}
            disabled={selection.modelIsUnavailable}
            onClick={() => {
              selection.setBooleanOption(descriptor, descriptor.currentValue !== true);
              onPick();
            }}
          />
        </div>
      ))}
    </>
  );
}

export const TraitsMenuContent = memo(function TraitsMenuContentImpl({
  provider,
  instanceId,
  models,
  model,
  prompt,
  onPromptChange,
  modelOptions,
  allowPromptInjectedEffort = true,
  planModeEnabled,
  ...persistence
}: TraitsMenuContentProps & TraitsPersistence) {
  const selection = useTraitsSelection({
    provider,
    ...(instanceId ? { instanceId } : {}),
    models,
    model,
    prompt,
    onPromptChange,
    modelOptions,
    allowPromptInjectedEffort,
    planModeEnabled,
    ...persistence,
  });
  const {
    descriptors,
    selectDescriptors,
    booleanDescriptors,
    primarySelectDescriptor,
    ultrathinkPromptControlled,
    ultrathinkInBodyText,
    hasAnyControls,
    modelIsUnavailable,
    updateDescriptors,
    handleSelectChange,
  } = selection;

  if (!hasAnyControls) {
    return null;
  }

  if (modelIsUnavailable) {
    return (
      <>
        {descriptors.map((descriptor, index) => {
          const value = getProviderOptionCurrentLabel(descriptor);
          if (!value) return null;
          return (
            <div key={descriptor.id}>
              {index > 0 ? <MenuDivider /> : null}
              <MenuGroup>
                <div className="px-2.5 pt-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-content/40">
                  {descriptor.label}
                </div>
                <div className="px-2 pb-1.5 text-muted-foreground/80 text-xs">{value}</div>
              </MenuGroup>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <>
      {selectDescriptors.map((descriptor, index) => {
        const selectedValue =
          ultrathinkPromptControlled && descriptor.id === primarySelectDescriptor?.id
            ? "ultrathink"
            : (getDescriptorStringValue(descriptor) ?? "");

        return (
          <div key={descriptor.id}>
            {index > 0 ? <MenuDivider /> : null}
            <MenuGroup>
              <div className="px-2.5 pt-1 pb-1 text-[10px] font-medium uppercase tracking-wide text-content/40">
                {descriptor.label}
              </div>
              {ultrathinkInBodyText && descriptor.id === primarySelectDescriptor?.id ? (
                <div className="px-2 pb-1.5 text-muted-foreground/80 text-xs">
                  Your prompt contains &quot;ultrathink&quot; in the text. Remove it to change this
                  option.
                </div>
              ) : null}
              <MenuRadioGroup
                value={selectedValue}
                onValueChange={(value) => handleSelectChange(descriptor, value)}
              >
                {descriptor.options.map((option) => (
                  <MenuRadioItem
                    key={option.id}
                    value={option.id}
                    hideIndicator
                    // Base UI keeps radio menus open by default. Close on pick so
                    // the traits menu behaves like the model picker.
                    closeOnClick
                    disabled={ultrathinkInBodyText && descriptor.id === primarySelectDescriptor?.id}
                    className="rounded-lg text-[13px] text-content data-checked:bg-selection data-highlighted:bg-selection data-highlighted:text-content"
                  >
                    <span className="flex w-full min-w-0 flex-col">
                      <span className="flex w-full min-w-0 items-center justify-between gap-3">
                        <span className="min-w-0 truncate">
                          {option.label}
                          {option.isDefault ? (
                            <>
                              {" "}
                              <DefaultBadge />
                            </>
                          ) : null}
                        </span>
                        <MenuRadioItemIndicator>
                          <Check className="size-3.5 shrink-0 text-content/50" strokeWidth={2} />
                        </MenuRadioItemIndicator>
                      </span>
                      {option.description ? (
                        <span className="max-w-56 text-pretty text-[11px] text-content/50">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          </div>
        );
      })}
      {booleanDescriptors.map((descriptor, index) => {
        const selectedValue = descriptor.currentValue === true ? "on" : "off";

        return (
          <div key={descriptor.id}>
            {index > 0 || selectDescriptors.length > 0 ? <MenuDivider /> : null}
            <MenuGroup>
              <div className="px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-content/40">
                {descriptor.label}
              </div>
              <MenuRadioGroup
                value={selectedValue}
                onValueChange={(value) => {
                  updateDescriptors(
                    replaceDescriptorCurrentValue(descriptors, descriptor.id, value === "on"),
                  );
                }}
              >
                {(["on", "off"] as const).map((value) => (
                  <MenuRadioItem
                    key={value}
                    value={value}
                    hideIndicator
                    closeOnClick
                    className="rounded-lg text-[13px] text-content data-checked:bg-selection data-highlighted:bg-selection data-highlighted:text-content"
                  >
                    <span className="flex w-full min-w-0 items-center justify-between gap-3">
                      <span>{value === "on" ? "On" : "Off"}</span>
                      <MenuRadioItemIndicator>
                        <Check className="size-3.5 shrink-0 text-content/50" strokeWidth={2} />
                      </MenuRadioItemIndicator>
                    </span>
                  </MenuRadioItem>
                ))}
              </MenuRadioGroup>
            </MenuGroup>
          </div>
        );
      })}
    </>
  );
});

/**
 * Build the traits trigger's text label plus whether the fast-mode bolt should
 * render. Claude and Cursor expose fast mode as a boolean, while Codex exposes
 * it through the Standard/Fast service tiers. In either form, fast mode is a
 * lightning bolt when on and nothing at all when off. The one exception is when
 * fast mode is the only trait, where a bare bolt (or bare chevron) would leave
 * the trigger unreadable.
 */
export function buildTraitsTriggerDisplay(input: {
  provider: ProviderDriverKind;
  descriptors: ReadonlyArray<ProviderOptionDescriptor>;
  primarySelectDescriptorId: string | null;
  ultrathinkPromptControlled: boolean;
}): { label: string; showFastModeIcon: boolean } {
  let fastModeFallbackLabel: string | null = null;
  let fastModeEnabled = false;
  const labels: Array<string> = [];
  for (const descriptor of input.descriptors) {
    if (descriptor.id === "fastMode" && descriptor.type === "boolean") {
      fastModeEnabled = descriptor.currentValue === true;
      fastModeFallbackLabel = fastModeEnabled ? "Fast" : "Normal";
      continue;
    }
    if (
      input.provider === "codex" &&
      descriptor.id === "serviceTier" &&
      descriptor.type === "select"
    ) {
      const currentValue = getProviderOptionCurrentValue(descriptor);
      const fastTier = descriptor.options.find(({ label }) => label === "Fast");
      if (fastTier && (currentValue === "default" || currentValue === fastTier.id)) {
        fastModeEnabled = currentValue === fastTier.id;
        fastModeFallbackLabel =
          descriptor.options.find(({ id }) => id === currentValue)?.label ??
          (fastModeEnabled ? "Fast" : "Normal");
        continue;
      }
    }
    const label =
      input.ultrathinkPromptControlled && descriptor.id === input.primarySelectDescriptorId
        ? "Ultrathink"
        : descriptor.type === "boolean"
          ? `${descriptor.label} ${descriptor.currentValue === true ? "On" : "Off"}`
          : getProviderOptionCurrentLabel(descriptor);
    if (typeof label === "string" && label.length > 0) {
      labels.push(label);
    }
  }

  // Only fall back to text when fast mode is genuinely the sole trait. Keying
  // off an empty label list alone would also catch descriptors that resolved to
  // no label at all, printing a bogus "Normal" for a model without fast mode.
  if (labels.length === 0 && fastModeFallbackLabel !== null) {
    return { label: fastModeFallbackLabel, showFastModeIcon: false };
  }
  return { label: labels.join(" · "), showFastModeIcon: fastModeEnabled };
}

export const TraitsPicker = memo(function TraitsPicker({
  provider,
  instanceId,
  models,
  model,
  prompt,
  onPromptChange,
  modelOptions,
  allowPromptInjectedEffort = true,
  planModeEnabled,
  triggerVariant,
  triggerClassName,
  isComposerOwned,
  size = "sm",
  hidden = false,
  ...persistence
}: TraitsMenuContentProps &
  TraitsPersistence & {
    size?: ComposerControlSize;
    hidden?: boolean;
  }) {
  const composerRef = useComposerHandleContext();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [isMenuOpen, setIsMenuOpen] = useComposerMenuState(hidden);
  const { descriptors, primarySelectDescriptor, ultrathinkPromptControlled } =
    getTraitsSectionVisibility({
      provider,
      models,
      model,
      prompt,
      modelOptions,
      allowPromptInjectedEffort,
      planModeEnabled,
    });
  if (
    !shouldRenderTraitsControls({
      provider,
      models,
      model,
      prompt,
      modelOptions,
      allowPromptInjectedEffort,
      planModeEnabled,
    })
  ) {
    return null;
  }

  const { label: triggerLabel, showFastModeIcon } = buildTraitsTriggerDisplay({
    provider,
    descriptors,
    primarySelectDescriptorId: primarySelectDescriptor?.id ?? null,
    ultrathinkPromptControlled,
  });
  const accessibleLabel = showFastModeIcon ? `${triggerLabel}, Fast mode on` : triggerLabel;
  const fastModeIcon = showFastModeIcon ? (
    <>
      <ComposerControlIcon
        icon={ZapIcon}
        size={size}
        className={cn(
          "fill-current opacity-80",
          size === "xs"
            ? "text-current"
            : provider === "claudeAgent"
              ? "text-[#d97757]"
              : "text-foreground",
        )}
      />
      <span className="sr-only">Fast mode on</span>
    </>
  ) : null;

  const isCodexStyle = provider === "codex";

  // Donor SelectPill semantics: picks and toggles restore focus (editor when
  // composer-owned, trigger otherwise); outside clicks just close.
  const closeDonorMenu = (restore: boolean) => {
    setIsMenuOpen(false);
    if (!restore) return;
    if (isComposerOwned) {
      composerRef?.current?.focusAtEnd();
    } else {
      triggerRef.current?.focus();
    }
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <ComposerControl
              ref={triggerRef}
              aria-label={accessibleLabel}
              data-composer-shortcut={isComposerOwned ? "composer.effort" : undefined}
              variant={triggerVariant ?? "ghost"}
              size={size}
              className={cn(
                isCodexStyle
                  ? "min-w-0 max-w-40 shrink justify-start overflow-hidden whitespace-nowrap sm:max-w-48"
                  : "shrink-0 whitespace-nowrap",
                triggerClassName,
              )}
              aria-expanded={isMenuOpen}
              aria-haspopup="menu"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            />
          }
        >
          {isCodexStyle ? (
            // The label truncates itself; clipping the wrapper too would cut off
            // the chevron, whose negative end margin overhangs the wrapper edge.
            <span
              className={cn(
                "flex min-w-0 w-full items-center",
                size === "xs" ? "gap-1" : "gap-1.5",
              )}
            >
              {fastModeIcon ?? (
                <span
                  data-composer-control-compact-icon
                  className="pointer-events-none invisible absolute"
                >
                  <ComposerControlIcon icon={GaugeIcon} size={size} />
                </span>
              )}
              <span data-composer-control-label className="min-w-0 truncate">
                {triggerLabel}
              </span>
              <ComposerControlChevron size={size} />
            </span>
          ) : (
            <>
              {fastModeIcon ?? (
                <span
                  data-composer-control-compact-icon
                  className="pointer-events-none invisible absolute"
                >
                  <ComposerControlIcon icon={GaugeIcon} size={size} />
                </span>
              )}
              <span data-composer-control-label>{triggerLabel}</span>
              <ComposerControlChevron size={size} />
            </>
          )}
        </TooltipTrigger>
        <TooltipPopup side="top">{accessibleLabel}</TooltipPopup>
      </Tooltip>
      {isMenuOpen ? (
        <Popover
          anchor={triggerRef}
          side="top"
          width={210}
          maxHeight={480}
          autoFocus
          tabIndex={-1}
          role="menu"
          onKeyDown={navigateTraitsMenu}
          aria-label="Reasoning and settings"
          className="overflow-y-auto overscroll-none p-1"
          onDismiss={(reason) => closeDonorMenu(reason === "escape")}
          data-model-control
          data-chat-composer-floating-layer="true"
        >
          <TraitsDonorMenuContent
            provider={provider}
            {...(instanceId ? { instanceId } : {})}
            models={models}
            model={model}
            prompt={prompt}
            onPromptChange={onPromptChange}
            modelOptions={modelOptions}
            allowPromptInjectedEffort={allowPromptInjectedEffort}
            planModeEnabled={planModeEnabled}
            {...persistence}
            onPick={() => closeDonorMenu(true)}
          />
        </Popover>
      ) : null}
    </>
  );
});
