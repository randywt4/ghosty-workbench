/* Global sidebar session filters: statuses + time + provider only.
   Archive stays in T3's separate archive manager, so there is no
   showArchived filter here. Status buckets follow T3
   resolveThreadStatusPill labels (see components/Sidebar.logic.ts). */

export type SessionTimeFilter = "all" | "today" | "7d" | "30d";

export type SessionStatusFilter = {
  working: boolean;
  needsApproval: boolean;
  done: boolean;
};

export type SessionSidebarFilters = {
  /** Provider keys (`environmentId:instanceId`) excluded from the list. */
  hiddenProviders: string[];
  time: SessionTimeFilter;
  status: SessionStatusFilter;
};

export const DEFAULT_SESSION_STATUS_FILTER: SessionStatusFilter = {
  working: false,
  needsApproval: false,
  done: false,
};

export const DEFAULT_SESSION_SIDEBAR_FILTERS: SessionSidebarFilters = {
  hiddenProviders: [],
  time: "all",
  status: { ...DEFAULT_SESSION_STATUS_FILTER },
};

const TIME_FILTERS: readonly SessionTimeFilter[] = ["all", "today", "7d", "30d"];

const WORKING_STATUSES: ReadonlySet<string> = new Set(["Working", "Connecting", "Waiting"]);

const NEEDS_APPROVAL_STATUSES: ReadonlySet<string> = new Set([
  "Pending Approval",
  "Awaiting Input",
  "Plan Ready",
]);

const DONE_STATUSES: ReadonlySet<string> = new Set(["Completed"]);

const DAY_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Coerce unknown input (e.g. parsed storage) to valid filters; never throws. */
export function sanitizeSessionSidebarFilters(value: unknown): SessionSidebarFilters {
  if (!isRecord(value)) {
    return {
      hiddenProviders: [],
      time: "all",
      status: { ...DEFAULT_SESSION_STATUS_FILTER },
    };
  }
  const time =
    typeof value.time === "string" && (TIME_FILTERS as readonly string[]).includes(value.time)
      ? (value.time as SessionTimeFilter)
      : "all";
  const hiddenProviders = Array.isArray(value.hiddenProviders)
    ? [
        ...new Set(
          value.hiddenProviders.filter(
            (entry): entry is string => typeof entry === "string" && entry.length > 0,
          ),
        ),
      ]
    : [];
  const status = isRecord(value.status) ? value.status : {};
  return {
    hiddenProviders,
    time,
    status: {
      working: status.working === true,
      needsApproval: status.needsApproval === true,
      done: status.done === true,
    },
  };
}

export function hasActiveSessionFilters(filters: SessionSidebarFilters): boolean {
  return (
    filters.hiddenProviders.length > 0 ||
    filters.time !== "all" ||
    filters.status.working ||
    filters.status.needsApproval ||
    filters.status.done
  );
}

export function timeFilterStart(time: SessionTimeFilter, now: number): number {
  if (time === "today") {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }
  if (time === "7d") return now - 7 * DAY_MS;
  if (time === "30d") return now - 30 * DAY_MS;
  return 0;
}

function matchesTimeFilter(updatedAt: string, time: SessionTimeFilter, now: number): boolean {
  if (time === "all") return true;
  const updated = Date.parse(updatedAt);
  if (Number.isNaN(updated)) return false;
  return updated >= timeFilterStart(time, now);
}

function matchesStatusFilter(status: string | null, filter: SessionStatusFilter): boolean {
  const any = filter.working || filter.needsApproval || filter.done;
  if (!any) return true;
  if (status === null) return false;
  if (filter.working && WORKING_STATUSES.has(status)) return true;
  if (filter.needsApproval && NEEDS_APPROVAL_STATUSES.has(status)) return true;
  if (filter.done && DONE_STATUSES.has(status)) return true;
  return false;
}

/**
 * Single-row predicate: OR across the selected statuses, AND with the
 * time window and provider exclusion.
 */
export function matchesSessionFilters(
  input: {
    updatedAt: string;
    providerKey: string;
    status: string | null;
  },
  filters: SessionSidebarFilters,
  now: number = Date.now(),
): boolean {
  if (filters.hiddenProviders.includes(input.providerKey)) return false;
  if (!matchesTimeFilter(input.updatedAt, filters.time, now)) return false;
  return matchesStatusFilter(input.status, filters.status);
}
