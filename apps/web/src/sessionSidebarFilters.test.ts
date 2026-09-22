import { describe, expect, it } from "vite-plus/test";
import {
  DEFAULT_SESSION_SIDEBAR_FILTERS,
  hasActiveSessionFilters,
  matchesSessionFilters,
  sanitizeSessionSidebarFilters,
  type SessionSidebarFilters,
} from "./sessionSidebarFilters";

const NOW = new Date(2026, 8, 22, 12, 0, 0).getTime();
const HOUR_MS = 60 * 60 * 1000;

function filters(overrides?: Partial<SessionSidebarFilters>): SessionSidebarFilters {
  return {
    hiddenProviders: [],
    time: "all",
    status: { working: false, needsApproval: false, done: false },
    ...overrides,
  };
}

describe("sanitizeSessionSidebarFilters", () => {
  it("returns defaults for non-objects", () => {
    for (const value of [null, undefined, 42, "x", []]) {
      expect(sanitizeSessionSidebarFilters(value)).toEqual(DEFAULT_SESSION_SIDEBAR_FILTERS);
    }
  });

  it("keeps valid values", () => {
    expect(
      sanitizeSessionSidebarFilters({
        hiddenProviders: ["env1:inst1"],
        time: "7d",
        status: { working: true, needsApproval: false, done: true },
      }),
    ).toEqual({
      hiddenProviders: ["env1:inst1"],
      time: "7d",
      status: { working: true, needsApproval: false, done: true },
    });
  });

  it("drops invalid time, non-string providers, duplicates and truthy status", () => {
    expect(
      sanitizeSessionSidebarFilters({
        hiddenProviders: ["a", 1, "", "a", null],
        time: "forever",
        status: { working: 1, needsApproval: "yes", done: 0 },
      }),
    ).toEqual({
      hiddenProviders: ["a"],
      time: "all",
      status: { working: false, needsApproval: false, done: false },
    });
  });
});

describe("hasActiveSessionFilters", () => {
  it("is inactive for defaults", () => {
    expect(hasActiveSessionFilters(filters())).toBe(false);
  });

  it("is active for provider, time or any status", () => {
    expect(hasActiveSessionFilters(filters({ hiddenProviders: ["a"] }))).toBe(true);
    expect(hasActiveSessionFilters(filters({ time: "today" }))).toBe(true);
    expect(
      hasActiveSessionFilters(
        filters({ status: { working: true, needsApproval: false, done: false } }),
      ),
    ).toBe(true);
  });
});

describe("matchesSessionFilters", () => {
  const fresh = new Date(NOW - HOUR_MS).toISOString();

  it("passes everything with default filters", () => {
    expect(
      matchesSessionFilters({ updatedAt: fresh, providerKey: "e:i", status: null }, filters(), NOW),
    ).toBe(true);
  });

  it("maps T3 pill labels to status buckets with OR semantics", () => {
    const onlyWorking = filters({
      status: { working: true, needsApproval: false, done: false },
    });
    for (const status of ["Working", "Connecting", "Waiting"]) {
      expect(
        matchesSessionFilters({ updatedAt: fresh, providerKey: "e:i", status }, onlyWorking, NOW),
      ).toBe(true);
    }
    expect(
      matchesSessionFilters(
        { updatedAt: fresh, providerKey: "e:i", status: "Completed" },
        onlyWorking,
        NOW,
      ),
    ).toBe(false);
    expect(
      matchesSessionFilters(
        { updatedAt: fresh, providerKey: "e:i", status: null },
        onlyWorking,
        NOW,
      ),
    ).toBe(false);

    const approvalAndDone = filters({
      status: { working: false, needsApproval: true, done: true },
    });
    for (const status of ["Pending Approval", "Awaiting Input", "Plan Ready", "Completed"]) {
      expect(
        matchesSessionFilters(
          { updatedAt: fresh, providerKey: "e:i", status },
          approvalAndDone,
          NOW,
        ),
      ).toBe(true);
    }
    expect(
      matchesSessionFilters(
        { updatedAt: fresh, providerKey: "e:i", status: "Working" },
        approvalAndDone,
        NOW,
      ),
    ).toBe(false);
  });

  it("applies the time window and rejects unparseable dates", () => {
    const today = filters({ time: "today" });
    const midnight = new Date(NOW);
    midnight.setHours(0, 0, 0, 0);
    expect(
      matchesSessionFilters(
        {
          updatedAt: new Date(midnight.getTime() - 1).toISOString(),
          providerKey: "e:i",
          status: null,
        },
        today,
        NOW,
      ),
    ).toBe(false);
    expect(
      matchesSessionFilters(
        { updatedAt: "not-a-date", providerKey: "e:i", status: null },
        today,
        NOW,
      ),
    ).toBe(false);

    const week = filters({ time: "7d" });
    expect(
      matchesSessionFilters(
        {
          updatedAt: new Date(NOW - 8 * 24 * HOUR_MS).toISOString(),
          providerKey: "e:i",
          status: null,
        },
        week,
        NOW,
      ),
    ).toBe(false);
    expect(
      matchesSessionFilters(
        {
          updatedAt: new Date(NOW - 6 * 24 * HOUR_MS).toISOString(),
          providerKey: "e:i",
          status: null,
        },
        week,
        NOW,
      ),
    ).toBe(true);
  });

  it("excludes hidden provider keys and ANDs with other filters", () => {
    const hidden = filters({ hiddenProviders: ["env1:inst1"] });
    expect(
      matchesSessionFilters(
        { updatedAt: fresh, providerKey: "env1:inst1", status: "Working" },
        hidden,
        NOW,
      ),
    ).toBe(false);
    expect(
      matchesSessionFilters(
        { updatedAt: fresh, providerKey: "env1:other", status: "Working" },
        hidden,
        NOW,
      ),
    ).toBe(true);

    const combined = filters({
      hiddenProviders: ["env1:inst1"],
      time: "7d",
      status: { working: true, needsApproval: false, done: false },
    });
    expect(
      matchesSessionFilters(
        { updatedAt: fresh, providerKey: "env1:other", status: "Working" },
        combined,
        NOW,
      ),
    ).toBe(true);
    expect(
      matchesSessionFilters(
        {
          updatedAt: new Date(NOW - 8 * 24 * HOUR_MS).toISOString(),
          providerKey: "env1:other",
          status: "Working",
        },
        combined,
        NOW,
      ),
    ).toBe(false);
  });
});
