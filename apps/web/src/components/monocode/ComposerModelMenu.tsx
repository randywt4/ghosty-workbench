import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  ANTIGRAVITY_DEFAULT_MODEL,
  type ProviderDriverKind,
  type ProviderInstanceId,
  type ResolvedKeybindingsConfig,
} from "@t3tools/contracts";
import { resolveSelectableModel } from "@t3tools/shared/model";
import { useAtomValue } from "@effect/atom-react";
import { primaryServerKeybindingsAtom } from "../../state/server";
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, Search, Star } from "./icons";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import {
  adjacentModelPickerProvider,
  resolveModelPickerSelectedModel,
  shouldIncludeModelPickerOption,
  shouldOfferModelPickerSetup,
} from "../chat/ModelPickerContent";
import {
  modelPickerLegacySectionKey,
  modelPickerModelKey,
  parseModelPickerLegacySectionKey,
} from "../chat/modelPickerKeys";
import { buildModelPickerSearchText, scoreModelPickerSearch } from "../chat/modelPickerSearch";
import {
  isProviderInstancePickerReady,
  isProviderInstancePickerVisible,
  type ProviderInstanceEntry,
} from "../../providerInstances";
import { providerModelKey, sortProviderModelItems } from "../../modelOrdering";
import { getProviderStatusMessage } from "../chat/ProviderStatusBanner";
import type { ModelEsque } from "../chat/providerIconUtils";
import { isCommandPaletteOpen } from "../../commandPaletteBus";
import {
  modelPickerJumpCommandForIndex,
  modelPickerJumpIndexFromCommand,
  resolveShortcutCommand,
  shortcutLabelForCommand,
} from "../../keybindings";
import { useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";
import { Kbd } from "../ui/kbd";
import { cn } from "~/lib/utils";

// Model menu transplant from MonoCode bb3924b ModelPicker.tsx (ModelFlyout +
// ProviderTabButton): provider rail, search header, grouped rows, favorite
// stars, selected checks, recent-style provenance. T3 owns all data and
// behavior behind it: provider instances (one rail tab each, incl. custom
// instances), per-instance catalogs, locked provider/continuation, multi-model
// toggle, favorites persistence, legacy section, provider setup, unavailable
// models, jump shortcuts. Donor Tauri/harness stores are replaced by T3
// adapters; nothing below invents or drops a T3 capability.

type ModelMenuItem = {
  slug: string;
  name: string;
  shortName?: string;
  subProvider?: string;
  badge?: "new";
  instanceId: ProviderInstanceId;
  driverKind: ProviderDriverKind;
  instanceDisplayName: string;
  instanceAccentColor?: string | undefined;
  acpRegistryAgentId?: string | undefined;
  acpRegistryIconUrl?: string | undefined;
  continuationGroupKey?: string | undefined;
  isLegacy?: boolean | undefined;
  isUnavailable?: boolean | undefined;
};

const PROVIDER_TAB_SIZE = 32;
const PROVIDER_TAB_GAP = 4;
const PROVIDER_RAIL_PADDING = 12;

export function modelMenuFrameHeight(tabCount: number): number {
  if (tabCount <= 0) return 232;
  return (
    tabCount * PROVIDER_TAB_SIZE + (tabCount - 1) * PROVIDER_TAB_GAP + PROVIDER_RAIL_PADDING + 2
  );
}

function describeInstance(entry: ProviderInstanceEntry): string {
  if (!entry.enabled || entry.status === "disabled") {
    return `${entry.displayName} — Disabled in settings.`;
  }
  if (entry.status === "ready" && entry.isAvailable) {
    return entry.displayName;
  }
  const kind =
    entry.status === "error" ? "Unavailable" : entry.status === "warning" ? "Limited" : "Not ready";
  const msg = entry.snapshot.message?.trim();
  return msg ? `${entry.displayName} — ${kind}. ${msg}` : `${entry.displayName} — ${kind}.`;
}

export const ComposerModelMenu = memo(function ComposerModelMenu(props: {
  activeInstanceId: ProviderInstanceId;
  model: string;
  selectedModels?: ReadonlyArray<{ instanceId: ProviderInstanceId; model: string }>;
  onToggleModel?: (instanceId: ProviderInstanceId, model: string) => void;
  lockedProvider: ProviderDriverKind | null;
  lockedContinuationGroupKey?: string | null;
  instanceEntries: ReadonlyArray<ProviderInstanceEntry>;
  keybindings?: ResolvedKeybindingsConfig;
  modelOptionsByInstance: ReadonlyMap<ProviderInstanceId, ReadonlyArray<ModelEsque>>;
  terminalOpen: boolean;
  onRequestClose?: () => void;
  onOpenProviderSetup?: (instanceId: ProviderInstanceId) => void;
  getModelDisabledReason?: (instanceId: ProviderInstanceId, model: string) => string | null;
  onInstanceModelChange: (instanceId: ProviderInstanceId, model: string) => void;
}) {
  const {
    modelOptionsByInstance,
    instanceEntries,
    getModelDisabledReason,
    onInstanceModelChange,
    onToggleModel,
  } = props;
  const serverKeybindings = useAtomValue(primaryServerKeybindingsAtom);
  const keybindings = props.keybindings ?? serverKeybindings;
  const [searchQuery, setSearchQuery] = useState("");
  const [active, setActive] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: Number.NaN, y: Number.NaN, allow: false });
  const fromPointer = useRef(false);
  const favorites = useClientSettings((s) => s.favorites ?? []);
  const updateSettings = useUpdateClientSettings();

  const activeEntry = props.instanceEntries.find(
    (entry) => entry.instanceId === props.activeInstanceId,
  );
  const activeModel = resolveModelPickerSelectedModel({
    driverKind: activeEntry?.driverKind,
    model: props.model,
    options: modelOptionsByInstance.get(props.activeInstanceId) ?? [],
  });
  const activeModelSlug =
    activeModel?.slug ?? (props.model === ANTIGRAVITY_DEFAULT_MODEL ? "" : props.model);
  const activeModelKey = activeModelSlug
    ? modelPickerModelKey(props.activeInstanceId, activeModelSlug)
    : null;

  const selectedModelKeys = useMemo(
    () =>
      props.selectedModels?.map((selection) => {
        const entry = instanceEntries.find((entry) => entry.instanceId === selection.instanceId);
        const model = resolveModelPickerSelectedModel({
          driverKind: entry?.driverKind,
          model: selection.model,
          options: modelOptionsByInstance.get(selection.instanceId) ?? [],
        });
        return modelPickerModelKey(selection.instanceId, model?.slug ?? selection.model);
      }),
    [instanceEntries, modelOptionsByInstance, props.selectedModels],
  );
  const selectedModelKeySet = useMemo(
    () => new Set(selectedModelKeys ?? (activeModelKey ? [activeModelKey] : [])),
    [selectedModelKeys, activeModelKey],
  );
  const isLocked = props.lockedProvider !== null;
  const isSearching = searchQuery.trim().length > 0;
  const multiMode = onToggleModel !== undefined;

  const favoritesSet = useMemo(() => {
    return new Set(favorites.map((fav) => providerModelKey(fav.provider, fav.model)));
  }, [favorites]);

  const entryByInstanceId = useMemo(
    () => new Map(instanceEntries.map((entry) => [entry.instanceId, entry])),
    [instanceEntries],
  );
  const matchesLockedProvider = useCallback(
    (entry: Pick<ProviderInstanceEntry, "driverKind" | "continuationGroupKey">): boolean => {
      if (props.lockedProvider === null) return true;
      if (entry.driverKind !== props.lockedProvider) return false;
      if (!props.lockedContinuationGroupKey) return true;
      return entry.continuationGroupKey === props.lockedContinuationGroupKey;
    },
    [props.lockedContinuationGroupKey, props.lockedProvider],
  );

  const activeInstanceHasSelectableUnavailableModel =
    activeEntry !== undefined &&
    (modelOptionsByInstance.get(props.activeInstanceId) ?? []).some((option) =>
      shouldIncludeModelPickerOption({
        entry: activeEntry,
        option,
        activeInstanceId: props.activeInstanceId,
        activeModel: activeModelSlug,
      }),
    ) &&
    !isProviderInstancePickerReady(activeEntry);
  const activeInstanceNeedsSetup =
    props.onOpenProviderSetup !== undefined &&
    activeEntry !== undefined &&
    shouldOfferModelPickerSetup(
      activeEntry,
      modelOptionsByInstance.get(props.activeInstanceId) ?? [],
    );

  const [selectedInstanceId, setSelectedInstanceId] = useState<ProviderInstanceId | "favorites">(
    () => {
      if (
        props.lockedProvider !== null ||
        activeInstanceHasSelectableUnavailableModel ||
        activeInstanceNeedsSetup
      ) {
        return props.activeInstanceId;
      }
      return favorites.length > 0 ? "favorites" : props.activeInstanceId;
    },
  );
  const [expandedLegacyInstances, setExpandedLegacyInstances] = useState(
    () =>
      new Set<ProviderInstanceId>(
        modelOptionsByInstance
          .get(props.activeInstanceId)
          ?.some((model) => model.slug === activeModelSlug && model.isLegacy)
          ? [props.activeInstanceId]
          : [],
      ),
  );

  const selectableUnavailableInstanceIds = useMemo(() => {
    const instanceIds = new Set<ProviderInstanceId>();
    if (activeInstanceHasSelectableUnavailableModel) {
      instanceIds.add(props.activeInstanceId);
    }
    if (props.onOpenProviderSetup) {
      for (const entry of instanceEntries) {
        if (
          shouldOfferModelPickerSetup(entry, modelOptionsByInstance.get(entry.instanceId) ?? [])
        ) {
          instanceIds.add(entry.instanceId);
        }
      }
    }
    return instanceIds.size > 0 ? instanceIds : undefined;
  }, [
    activeInstanceHasSelectableUnavailableModel,
    instanceEntries,
    modelOptionsByInstance,
    props.activeInstanceId,
    props.onOpenProviderSetup,
  ]);
  const lockedDisabledInstanceIds = useMemo(() => {
    if (!isLocked) return undefined;
    const disabled = new Set<ProviderInstanceId>();
    for (const entry of instanceEntries) {
      if (!matchesLockedProvider(entry)) disabled.add(entry.instanceId);
    }
    return disabled;
  }, [instanceEntries, isLocked, matchesLockedProvider]);
  const sidebarInstanceEntries = useMemo(() => {
    const enabledEntries = instanceEntries.filter(isProviderInstancePickerVisible);
    if (!isLocked) return enabledEntries;
    const available: ProviderInstanceEntry[] = [];
    const disabled: ProviderInstanceEntry[] = [];
    for (const entry of enabledEntries) {
      if (matchesLockedProvider(entry)) available.push(entry);
      else disabled.push(entry);
    }
    return [...available, ...disabled];
  }, [instanceEntries, isLocked, matchesLockedProvider]);
  const showSidebar = !isSearching && sidebarInstanceEntries.length > 0;
  const instanceOrder = useMemo(
    () => instanceEntries.map((entry) => entry.instanceId),
    [instanceEntries],
  );

  const flatModels = useMemo(() => {
    const out: ModelMenuItem[] = [];
    for (const [instanceId, models] of modelOptionsByInstance) {
      const entry = entryByInstanceId.get(instanceId);
      if (!entry) continue;
      for (const model of models) {
        if (
          !shouldIncludeModelPickerOption({
            entry,
            option: model,
            activeInstanceId: props.activeInstanceId,
            activeModel: activeModelSlug,
          })
        ) {
          continue;
        }
        out.push({
          slug: model.slug,
          name: model.name,
          ...(model.shortName ? { shortName: model.shortName } : {}),
          ...(model.subProvider ? { subProvider: model.subProvider } : {}),
          ...(model.badge ? { badge: model.badge } : {}),
          ...(model.isLegacy ? { isLegacy: true } : {}),
          ...(model.isUnavailable ? { isUnavailable: true } : {}),
          instanceId,
          driverKind: entry.driverKind,
          instanceDisplayName: entry.displayName,
          ...(entry.accentColor ? { instanceAccentColor: entry.accentColor } : {}),
          ...(entry.acpRegistryAgentId ? { acpRegistryAgentId: entry.acpRegistryAgentId } : {}),
          ...(entry.acpRegistryIconUrl ? { acpRegistryIconUrl: entry.acpRegistryIconUrl } : {}),
          ...(entry.continuationGroupKey
            ? { continuationGroupKey: entry.continuationGroupKey }
            : {}),
        });
      }
    }
    return out;
  }, [modelOptionsByInstance, entryByInstanceId, props.activeInstanceId, activeModelSlug]);

  const filteredModels = useMemo(() => {
    let result = flatModels;
    if (searchQuery.trim()) {
      const rankedMatches = result
        .map((model) => ({
          model,
          score: scoreModelPickerSearch(
            {
              name: model.name,
              ...(model.shortName ? { shortName: model.shortName } : {}),
              ...(model.subProvider ? { subProvider: model.subProvider } : {}),
              driverKind: model.driverKind,
              providerDisplayName: model.instanceDisplayName,
              isFavorite: favoritesSet.has(providerModelKey(model.instanceId, model.slug)),
            },
            searchQuery,
          ),
          isFavorite: favoritesSet.has(providerModelKey(model.instanceId, model.slug)),
          tieBreaker: buildModelPickerSearchText({
            name: model.name,
            ...(model.shortName ? { shortName: model.shortName } : {}),
            ...(model.subProvider ? { subProvider: model.subProvider } : {}),
            driverKind: model.driverKind,
            providerDisplayName: model.instanceDisplayName,
          }),
        }))
        .filter(
          (
            rankedModel,
          ): rankedModel is {
            model: ModelMenuItem;
            score: number;
            isFavorite: boolean;
            tieBreaker: string;
          } => rankedModel.score !== null,
        );
      const scoped =
        props.lockedProvider !== null
          ? rankedMatches.filter((rankedModel) => matchesLockedProvider(rankedModel.model))
          : rankedMatches;
      return scoped
        .toSorted((a, b) => {
          const scoreDelta = a.score - b.score;
          if (scoreDelta !== 0) return scoreDelta;
          if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
          return a.tieBreaker.localeCompare(b.tieBreaker);
        })
        .map((rankedModel) => rankedModel.model);
    }

    if (props.lockedProvider !== null) {
      result = result.filter((m) => matchesLockedProvider(m));
      if (selectedInstanceId === "favorites") {
        result = result.filter((m) => favoritesSet.has(providerModelKey(m.instanceId, m.slug)));
      } else {
        result = result.filter((m) => m.instanceId === selectedInstanceId);
      }
    } else if (selectedInstanceId === "favorites") {
      result = result.filter((m) => favoritesSet.has(providerModelKey(m.instanceId, m.slug)));
    } else {
      result = result.filter((m) => m.instanceId === selectedInstanceId);
    }

    return sortProviderModelItems(result, {
      favoriteModelKeys: favoritesSet,
      groupFavorites: selectedInstanceId !== "favorites",
      instanceOrder: selectedInstanceId === "favorites" ? instanceOrder : [],
    });
  }, [
    favoritesSet,
    flatModels,
    instanceOrder,
    matchesLockedProvider,
    props.lockedProvider,
    searchQuery,
    selectedInstanceId,
  ]);

  const legacySection = useMemo(() => {
    if (isSearching || selectedInstanceId === "favorites") return null;
    const currentModels = filteredModels.filter((model) => !model.isLegacy);
    const legacyModels = filteredModels.filter((model) => model.isLegacy);
    if (legacyModels.length === 0) return null;
    return {
      key: modelPickerLegacySectionKey(selectedInstanceId),
      currentModels,
      legacyModels,
      isExpanded: expandedLegacyInstances.has(selectedInstanceId),
    };
  }, [expandedLegacyInstances, filteredModels, isSearching, selectedInstanceId]);

  // Visible rows: models plus an inline legacy-section toggle row, mirroring
  // the donor list where every row is navigable by the same active index.
  type VisibleRow =
    | { kind: "model"; model: ModelMenuItem }
    | { kind: "legacy"; key: string; count: number; expanded: boolean };
  const visibleRows = useMemo<VisibleRow[]>(() => {
    if (!legacySection) return filteredModels.map((model) => ({ kind: "model" as const, model }));
    const rows: VisibleRow[] = legacySection.currentModels.map((model) => ({
      kind: "model" as const,
      model,
    }));
    rows.push({
      kind: "legacy" as const,
      key: legacySection.key,
      count: legacySection.legacyModels.length,
      expanded: legacySection.isExpanded,
    });
    if (legacySection.isExpanded) {
      for (const model of legacySection.legacyModels) rows.push({ kind: "model", model });
    }
    return rows;
  }, [filteredModels, legacySection]);

  const selectedEntry =
    selectedInstanceId === "favorites" ? undefined : entryByInstanceId.get(selectedInstanceId);
  const providerSetupEntries =
    !isSearching && props.onOpenProviderSetup
      ? instanceEntries.filter(
          (entry) =>
            matchesLockedProvider(entry) &&
            shouldOfferModelPickerSetup(
              entry,
              modelOptionsByInstance.get(entry.instanceId) ?? [],
            ) &&
            (selectedEntry
              ? entry.instanceId === selectedEntry.instanceId
              : filteredModels.length === 0),
        )
      : [];

  const focusSearchInput = useCallback(() => {
    searchInputRef.current?.focus({ preventScroll: true });
  }, []);

  useLayoutEffect(() => {
    focusSearchInput();
  }, [focusSearchInput]);

  useEffect(() => {
    setActive(0);
  }, [searchQuery, selectedInstanceId]);

  useEffect(() => {
    setActive((index) => Math.min(index, Math.max(0, visibleRows.length - 1)));
  }, [visibleRows.length]);

  useEffect(() => {
    if (fromPointer.current) {
      fromPointer.current = false;
      return;
    }
    pointer.current.allow = false;
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  useEffect(() => {
    pointer.current.allow = false;
  }, [filteredModels]);

  const handleSelectInstance = useCallback(
    (instanceId: ProviderInstanceId | "favorites") => {
      setSelectedInstanceId(instanceId);
      setActive(0);
      window.requestAnimationFrame(() => {
        focusSearchInput();
      });
    },
    [focusSearchInput],
  );

  const toggleLegacySection = useCallback((instanceId: ProviderInstanceId) => {
    setExpandedLegacyInstances((expanded) => {
      const next = new Set(expanded);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  }, []);

  const handleModelSelect = useCallback(
    (modelSlug: string, instanceId: ProviderInstanceId, additive = false) => {
      if (getModelDisabledReason?.(instanceId, modelSlug)) return;
      const options = modelOptionsByInstance.get(instanceId);
      if (!options) return;
      const entry = entryByInstanceId.get(instanceId);
      if (!entry) return;
      const resolvedModel = resolveSelectableModel(entry.driverKind, modelSlug, options);
      if (resolvedModel) {
        if (additive && onToggleModel) onToggleModel(instanceId, resolvedModel);
        else onInstanceModelChange(instanceId, resolvedModel);
      }
    },
    [
      entryByInstanceId,
      getModelDisabledReason,
      modelOptionsByInstance,
      onInstanceModelChange,
      onToggleModel,
    ],
  );

  const toggleFavorite = useCallback(
    (instanceId: ProviderInstanceId, model: string) => {
      const newFavorites = [...favorites];
      const index = newFavorites.findIndex((f) => f.provider === instanceId && f.model === model);
      if (index >= 0) newFavorites.splice(index, 1);
      else newFavorites.push({ provider: instanceId, model });
      updateSettings({ favorites: newFavorites });
    },
    [favorites, updateSettings],
  );

  // T3 multi-model semantics (mirrors the previous menu exactly): an
  // ordinary click/Enter selects exactly one model and closes. Only an
  // explicit Shift+click / Shift+Enter adds to the selection (which requires
  // the multi-model toggle handler to be present at all).
  const activateRow = useCallback(
    (row: VisibleRow, additive: boolean) => {
      if (row.kind === "legacy") {
        const parsed = parseModelPickerLegacySectionKey(row.key);
        if (parsed) toggleLegacySection(parsed);
        return;
      }
      handleModelSelect(row.model.slug, row.model.instanceId, multiMode && additive);
    },
    [handleModelSelect, multiMode, toggleLegacySection],
  );

  const onListMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.clientX === pointer.current.x && event.clientY === pointer.current.y) return;
    pointer.current = { x: event.clientX, y: event.clientY, allow: true };
  };
  const onRowEnter = (index: number) => {
    if (!pointer.current.allow) return;
    fromPointer.current = true;
    setActive(index);
  };

  const onSearchKey = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      event.stopPropagation();
      setActive((index) => Math.min(visibleRows.length - 1, index + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      setActive((index) => Math.max(0, index - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      const row = visibleRows[active];
      if (row) activateRow(row, event.shiftKey);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      props.onRequestClose?.();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.stopPropagation();
    }
  };

  const onListKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!(event.target instanceof Element) || !event.target.closest('[role="listbox"]')) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => Math.min(visibleRows.length - 1, Math.max(0, index + direction)));
      return;
    }
    if (event.key !== "Enter") return;
    if (
      event.target instanceof HTMLButtonElement &&
      event.target.getAttribute("role") !== "option"
    ) {
      return;
    }
    event.preventDefault();
    const row = visibleRows[active];
    if (row) activateRow(row, event.shiftKey);
  };

  // Preserved T3 capability: provider-rail jumps + numeric model jumps while
  // the menu is open, terminal-aware like the previous menu.
  const modelJumpShortcutContext = useMemo(
    () =>
      ({
        terminalFocus: false,
        terminalOpen: props.terminalOpen,
        modelPickerOpen: true,
      }) as const,
    [props.terminalOpen],
  );
  useEffect(() => {
    const onWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || isCommandPaletteOpen()) return;
      const command = resolveShortcutCommand(event, keybindings, {
        platform: navigator.platform,
        context: modelJumpShortcutContext,
      });
      if (command === "modelPicker.previousProvider" || command === "modelPicker.nextProvider") {
        event.preventDefault();
        event.stopPropagation();
        const next = adjacentModelPickerProvider({
          entries: sidebarInstanceEntries,
          selectedInstanceId,
          direction: command === "modelPicker.nextProvider" ? 1 : -1,
          disabledInstanceIds: lockedDisabledInstanceIds,
          selectableUnavailableInstanceIds,
        });
        setSearchQuery("");
        handleSelectInstance(next);
        return;
      }
      const jumpIndex = modelPickerJumpIndexFromCommand(command ?? "");
      if (jumpIndex === null) return;
      event.preventDefault();
      event.stopPropagation();
      const selectable = visibleRows.filter(
        (row) =>
          row.kind === "model" && !getModelDisabledReason?.(row.model.instanceId, row.model.slug),
      );
      const target = selectable[jumpIndex];
      if (target?.kind === "model")
        handleModelSelect(target.model.slug, target.model.instanceId, false);
    };
    window.addEventListener("keydown", onWindowKeyDown, true);
    return () => window.removeEventListener("keydown", onWindowKeyDown, true);
  }, [
    getModelDisabledReason,
    handleModelSelect,
    handleSelectInstance,
    keybindings,
    lockedDisabledInstanceIds,
    modelJumpShortcutContext,
    multiMode,
    selectableUnavailableInstanceIds,
    selectedInstanceId,
    sidebarInstanceEntries,
    visibleRows,
  ]);

  const modelJumpLabelByKey = useMemo(() => {
    const mapping = new Map<string, string>();
    let selectableModelIndex = 0;
    for (const row of visibleRows) {
      if (row.kind !== "model") continue;
      if (getModelDisabledReason?.(row.model.instanceId, row.model.slug)) continue;
      const jumpCommand = modelPickerJumpCommandForIndex(selectableModelIndex);
      if (!jumpCommand) break;
      const label = shortcutLabelForCommand(keybindings, jumpCommand, {
        platform: navigator.platform,
        context: modelJumpShortcutContext,
      });
      if (label) mapping.set(modelPickerModelKey(row.model.instanceId, row.model.slug), label);
      selectableModelIndex += 1;
    }
    return mapping;
  }, [getModelDisabledReason, keybindings, modelJumpShortcutContext, visibleRows]);

  return (
    <>
      {showSidebar ? (
        <nav
          role="tablist"
          aria-label="Providers"
          aria-orientation="vertical"
          className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-stroke p-1.5"
        >
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  role="tab"
                  aria-label="Favorites"
                  aria-selected={selectedInstanceId === "favorites"}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={
                    selectedInstanceId === "favorites"
                      ? undefined
                      : () => handleSelectInstance("favorites")
                  }
                  onClick={() => handleSelectInstance("favorites")}
                  className={cn(
                    "grid size-8 shrink-0 place-items-center rounded-md",
                    selectedInstanceId === "favorites"
                      ? "bg-selection-strong text-content"
                      : "text-content/45 hover:bg-content/8 hover:text-content",
                  )}
                >
                  <span className="shrink-0">
                    <Star
                      className="size-4"
                      strokeWidth={1.75}
                      fill={selectedInstanceId === "favorites" ? "currentColor" : "none"}
                    />
                  </span>
                </button>
              }
            />
            <TooltipPopup>Favorites</TooltipPopup>
          </Tooltip>
          {sidebarInstanceEntries.map((entry) => {
            const isUnavailable = !isProviderInstancePickerReady(entry);
            const isContextDisabled = lockedDisabledInstanceIds?.has(entry.instanceId) ?? false;
            const reachable = selectableUnavailableInstanceIds?.has(entry.instanceId) ?? false;
            const isDisabled = (isUnavailable && !reachable) || isContextDisabled;
            const isSelected = selectedInstanceId === entry.instanceId;
            const tooltip = isUnavailable ? describeInstance(entry) : entry.displayName;
            return (
              <Tooltip key={entry.instanceId}>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      role="tab"
                      aria-label={tooltip}
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={
                        isSelected || isDisabled
                          ? undefined
                          : () => handleSelectInstance(entry.instanceId)
                      }
                      onClick={() => {
                        if (!isDisabled) handleSelectInstance(entry.instanceId);
                      }}
                      className={cn(
                        "grid size-8 shrink-0 place-items-center rounded-md disabled:cursor-not-allowed disabled:opacity-40",
                        isSelected
                          ? "bg-selection-strong text-content"
                          : "text-content/45 hover:bg-content/8 hover:text-content",
                      )}
                    >
                      <span className="shrink-0">
                        <ProviderInstanceIcon
                          driverKind={entry.driverKind}
                          displayName={entry.displayName}
                          accentColor={entry.accentColor}
                          acpRegistryAgentId={entry.acpRegistryAgentId}
                          acpRegistryIconUrl={entry.acpRegistryIconUrl}
                          className="size-4"
                          iconClassName="size-4"
                        />
                      </span>
                    </button>
                  }
                />
                <TooltipPopup>{tooltip}</TooltipPopup>
              </Tooltip>
            );
          })}
        </nav>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <label className="flex shrink-0 items-center gap-2 border-b border-stroke px-3 py-2.5 text-content/50">
          <Search className="size-3.5 shrink-0" strokeWidth={1.75} />
          <input
            data-popover-autofocus
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            placeholder="Search models"
            aria-label="Search models"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-[13px] text-content outline-none placeholder:text-content/40"
            onChange={(event) => setSearchQuery(event.target.value)}
            onKeyDown={onSearchKey}
          />
        </label>

        <div
          ref={listRef}
          role="listbox"
          aria-label="Models"
          onMouseMove={onListMouseMove}
          onKeyDown={onListKey}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1"
        >
          {visibleRows.length === 0 ? (
            <div className="px-2 py-3 text-[12px] text-content/50">
              {selectedInstanceId === "favorites" && !searchQuery.trim()
                ? "No favorite models"
                : "No matching models"}
            </div>
          ) : (
            visibleRows.map((row, index) => {
              const highlighted = index === active;
              if (row.kind === "legacy") {
                return (
                  <button
                    key={row.key}
                    ref={highlighted ? activeRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={highlighted}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => onRowEnter(index)}
                    onClick={() => {
                      const parsed = parseModelPickerLegacySectionKey(row.key);
                      if (parsed) toggleLegacySection(parsed);
                    }}
                    className={cn(
                      "flex h-9 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px]",
                      highlighted ? "bg-selection text-content" : "text-content hover:bg-content/5",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium leading-5">Legacy models</span>
                      <span className="block text-[11px] leading-4 text-content/50">
                        {row.count} models
                      </span>
                    </span>
                    <ChevronRight
                      className={cn(
                        "size-3.5 shrink-0 text-content/45",
                        row.expanded && "rotate-90",
                      )}
                      strokeWidth={1.75}
                    />
                  </button>
                );
              }
              const item = row.model;
              const key = modelPickerModelKey(item.instanceId, item.slug);
              const selected = multiMode ? selectedModelKeySet.has(key) : key === activeModelKey;
              const favorited = favoritesSet.has(providerModelKey(item.instanceId, item.slug));
              const disabledReason = getModelDisabledReason?.(item.instanceId, item.slug) ?? null;
              const disabled = disabledReason !== null;
              const provenance = item.subProvider
                ? `${item.instanceDisplayName} · ${item.subProvider}`
                : item.instanceDisplayName;
              return (
                <div
                  key={key}
                  className={cn(
                    "group flex h-8 items-center rounded-lg px-1",
                    disabled
                      ? "text-content/30"
                      : highlighted
                        ? "bg-selection text-content"
                        : "text-content hover:bg-content/5",
                  )}
                  onMouseEnter={() => onRowEnter(index)}
                >
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          ref={highlighted ? activeRef : undefined}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          aria-label={`${item.name}, ${provenance}`}
                          disabled={disabled}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) =>
                            handleModelSelect(
                              item.slug,
                              item.instanceId,
                              multiMode && event.shiftKey,
                            )
                          }
                          className="flex min-w-0 flex-1 items-center gap-2 px-1.5 text-left text-[13px] disabled:cursor-not-allowed"
                        >
                          <span className="min-w-0 flex-1 truncate">{item.name}</span>
                        </button>
                      }
                    />
                    <TooltipPopup>{disabledReason ?? undefined}</TooltipPopup>
                  </Tooltip>
                  {selectedInstanceId === "favorites" ? (
                    <span className="max-w-24 shrink-0 truncate text-[10px] text-content/40">
                      {provenance}
                    </span>
                  ) : null}
                  {item.badge === "new" ? (
                    <span
                      className="shrink-0 rounded border border-update/35 bg-update/15 px-0.5 py-px text-[10px] font-bold uppercase leading-none tracking-wide text-update-foreground"
                      aria-label="New model"
                    >
                      New
                    </span>
                  ) : null}
                  {modelJumpLabelByKey.get(key) ? (
                    <Kbd className="h-4 min-w-0 shrink-0 rounded-sm px-1.5 text-[10px]">
                      {modelJumpLabelByKey.get(key)}
                    </Kbd>
                  ) : null}
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <button
                          type="button"
                          aria-label={favorited ? "Remove from favorites" : "Add to favorites"}
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleFavorite(item.instanceId, item.slug);
                          }}
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-md transition-opacity",
                            favorited
                              ? "text-content/60"
                              : "text-content/35 opacity-0 group-hover:opacity-100 focus:opacity-100",
                          )}
                        >
                          <Star
                            className="size-3.5"
                            strokeWidth={1.75}
                            fill={favorited ? "currentColor" : "none"}
                          />
                        </button>
                      }
                    />
                    <TooltipPopup>
                      {favorited ? "Remove from favorites" : "Add to favorites"}
                    </TooltipPopup>
                  </Tooltip>
                  {selected ? (
                    <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center">
                      <Check className="size-3.5 text-content/55" strokeWidth={2} />
                    </span>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {providerSetupEntries.length > 0 ? (
          <div className="max-h-44 shrink-0 overflow-y-auto border-t border-stroke p-2">
            {providerSetupEntries.map((entry) => (
              <div key={entry.instanceId} className="px-1 py-1.5 text-xs leading-snug">
                <p className="line-clamp-3 text-content/50">
                  {getProviderStatusMessage(entry.snapshot)}
                </p>
                <button
                  type="button"
                  className="mt-1 px-0 text-left text-[12px] text-content underline underline-offset-2 hover:text-content"
                  onClick={() => {
                    props.onRequestClose?.();
                    props.onOpenProviderSetup?.(entry.instanceId);
                  }}
                >
                  {providerSetupEntries.length > 1
                    ? `Set up ${entry.displayName}`
                    : "Open provider setup"}
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
});
