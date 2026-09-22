import { useMemo, useState } from "react";
import { useEnvironments } from "../../state/environments";
import { useUiStateStore } from "../../uiStateStore";
import {
  deriveProviderInstanceEntries,
  applyProviderInstanceSettings,
} from "../../providerInstances";
import {
  DEFAULT_SESSION_SIDEBAR_FILTERS,
  hasActiveSessionFilters,
} from "../../sessionSidebarFilters";
import { ProviderInstanceIcon } from "../chat/ProviderInstanceIcon";
import { ListFilter } from "./icons";
import { SessionFiltersMenu } from "./SessionFiltersMenu";

/** One donor filter menu for all projects; provider identities remain environment-scoped. */
export function SessionFilterButton() {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const { environments } = useEnvironments();
  const filters = useUiStateStore(
    (state) => state.sessionSidebarFilters ?? DEFAULT_SESSION_SIDEBAR_FILTERS,
  );
  const onChange = useUiStateStore((state) => state.setSessionSidebarFilters);
  const providers = useMemo(
    () =>
      environments.flatMap((environment) => {
        const config = environment.serverConfig;
        const entries = deriveProviderInstanceEntries(config?.providers ?? []);
        return (config ? applyProviderInstanceSettings(entries, config.settings) : entries).map(
          (entry) => ({
            id: `${environment.environmentId}:${entry.instanceId}`,
            label:
              environments.length > 1
                ? `${entry.displayName} (${environment.label})`
                : entry.displayName,
            icon: (
              <ProviderInstanceIcon
                driverKind={entry.driverKind}
                displayName={entry.displayName}
                accentColor={entry.accentColor}
                acpRegistryAgentId={entry.acpRegistryAgentId}
                acpRegistryIconUrl={entry.acpRegistryIconUrl}
                className="size-3.5"
                iconClassName="size-3.5"
              />
            ),
          }),
        );
      }),
    [environments],
  );
  const active = hasActiveSessionFilters(filters);
  return (
    <>
      <button
        type="button"
        aria-label="Filter sessions"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
        className={`inline-flex size-6 items-center justify-center rounded-md ${active ? "bg-selection text-content" : "text-content/50 hover:bg-content/5 hover:text-content"}`}
      >
        <ListFilter className="size-3" strokeWidth={1.75} />
      </button>
      {anchor && (
        <SessionFiltersMenu
          anchor={anchor}
          providers={providers}
          filters={filters}
          onChange={onChange}
          onClose={() => setAnchor(null)}
        />
      )}
    </>
  );
}
