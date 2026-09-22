/* MonoCode SessionFiltersMenu.tsx at bb3924b, adapted: T3 provider keys
   (`environmentId:instanceId`), no archive row (T3 keeps its separate
   archive manager). Visual structure, classes and rows are donor-exact;
   FilterItem/SectionLabel are shared from FilterControls. */
import type { ReactNode } from "react";
import {
  DEFAULT_SESSION_SIDEBAR_FILTERS,
  hasActiveSessionFilters,
  type SessionSidebarFilters,
  type SessionTimeFilter,
} from "../../sessionSidebarFilters";
import { FilterItem, SectionLabel } from "./FilterControls";
import { Popover } from "./Popover";

const MENU_WIDTH = 228;

export interface SessionFilterProvider {
  id: string;
  label: string;
  icon?: ReactNode;
}

type Props = {
  anchor: HTMLElement;
  providers: SessionFilterProvider[];
  filters: SessionSidebarFilters;
  onChange: (filters: SessionSidebarFilters) => void;
  onClose: () => void;
};

const TIME_OPTIONS: { id: SessionTimeFilter; label: string }[] = [
  { id: "all", label: "All time" },
  { id: "today", label: "Today" },
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
];

export function SessionFiltersMenu({ anchor, providers, filters, onChange, onClose }: Props) {
  const hiddenProviders = new Set(filters.hiddenProviders);

  const toggleProvider = (id: string) => {
    const next = new Set(hiddenProviders);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...filters, hiddenProviders: [...next] });
  };

  const setTime = (time: SessionTimeFilter) => {
    onChange({ ...filters, time });
  };

  const toggleStatus = (key: keyof SessionSidebarFilters["status"]) => {
    onChange({
      ...filters,
      status: { ...filters.status, [key]: !filters.status[key] },
    });
  };

  return (
    <Popover
      anchor={anchor}
      gap={0}
      width={MENU_WIDTH}
      maxHeight={480}
      autoFocus
      tabIndex={-1}
      onDismiss={(reason) => {
        onClose();
        if (reason === "escape") anchor.focus();
      }}
      role="menu"
      aria-label="Filter sessions"
      onContextMenu={(event) => event.preventDefault()}
      className="overflow-y-auto overscroll-none p-1"
    >
      <SectionLabel>Status</SectionLabel>
      <FilterItem
        label="Working"
        checked={filters.status.working}
        onClick={() => toggleStatus("working")}
      />
      <FilterItem
        label="Needs input"
        checked={filters.status.needsApproval}
        onClick={() => toggleStatus("needsApproval")}
      />
      <FilterItem
        label="Unread completion"
        checked={filters.status.done}
        onClick={() => toggleStatus("done")}
      />

      <SectionLabel>Time</SectionLabel>
      {TIME_OPTIONS.map((option) => (
        <FilterItem
          key={option.id}
          label={option.label}
          checked={filters.time === option.id}
          onClick={() => setTime(option.id)}
        />
      ))}

      {providers.length > 0 ? (
        <>
          <SectionLabel>Provider</SectionLabel>
          {providers.map((provider) => (
            <FilterItem
              key={provider.id}
              label={provider.label}
              checked={!hiddenProviders.has(provider.id)}
              icon={provider.icon}
              onClick={() => toggleProvider(provider.id)}
            />
          ))}
        </>
      ) : null}

      {hasActiveSessionFilters(filters) ? (
        <>
          <div role="separator" className="my-1 h-px bg-content/10" />
          <button
            type="button"
            role="menuitem"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onChange(DEFAULT_SESSION_SIDEBAR_FILTERS)}
            className="flex h-7 w-full items-center rounded-lg px-2 text-left text-[13px] leading-none text-content/70 hover:bg-content/5 hover:text-content"
          >
            Clear filters
          </button>
        </>
      ) : null}
    </Popover>
  );
}
