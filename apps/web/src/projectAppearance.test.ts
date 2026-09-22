import { describe, expect, it } from "vite-plus/test";
import {
  projectAppearanceKey,
  projectNotificationsMuted,
  sanitizeProjectAppearance,
  resolveProjectAppearance,
  projectAppearanceLane,
} from "./projectAppearance";

describe("Workbench project presentation", () => {
  it("keeps grouped appearance stable across representatives without hiding active members", () => {
    const a = { environmentId: "a", workspaceRoot: "/one" };
    const b = { environmentId: "b", workspaceRoot: "/two" };
    const appearances = {
      [projectAppearanceKey(a)]: { mascot: "mushroom", group: "Work", archived: true },
      [projectAppearanceKey(b)]: { mascot: "ghost", group: "Personal", pinned: true },
    };
    const first = { ...a, memberProjects: [a, b] };
    const switched = { ...b, memberProjects: [b, a] };
    expect(resolveProjectAppearance(first, appearances)).toEqual(
      resolveProjectAppearance(switched, appearances),
    );
    expect(resolveProjectAppearance(first, appearances)).toMatchObject({
      mascot: "mushroom",
      group: "Work",
      pinned: true,
      archived: false,
    });
    expect(projectAppearanceKey(first)).toBe(projectAppearanceKey(switched));
    expect(projectAppearanceLane({ pinned: true, group: "Work" })).toBe(
      projectAppearanceLane({ pinned: true }),
    );
    expect(projectAppearanceLane({ group: "Work" })).not.toBe(projectAppearanceLane(undefined));
  });
  it("skips empty legacy preferences when resolving grouped appearance", () => {
    const a = { environmentId: "a", workspaceRoot: "/one" };
    const b = { environmentId: "b", workspaceRoot: "/two" };
    expect(
      resolveProjectAppearance(
        { ...a, memberProjects: [a, b] },
        {
          [projectAppearanceKey(a)]: {},
          [projectAppearanceKey(b)]: { mascot: "mushroom", group: "Work", pinned: true },
        },
      ),
    ).toMatchObject({ mascot: "mushroom", group: "Work", pinned: true, archived: false });
  });
  it("keeps different hosts and project roots separate", () => {
    const key = projectAppearanceKey({ environmentId: "local", workspaceRoot: "C:/work/one" });
    expect(key).not.toBe(
      projectAppearanceKey({ environmentId: "remote", workspaceRoot: "C:/work/one" }),
    );
    expect(key).not.toBe(
      projectAppearanceKey({ environmentId: "local", workspaceRoot: "C:/work/two" }),
    );
    expect(key).toBe(
      projectAppearanceKey({ environmentId: "local", workspaceRoot: "C:\\work\\one\\" }),
    );
  });
  it("restores valid preferences without accepting malformed entries", () => {
    expect(
      sanitizeProjectAppearance({
        one: {
          color: "#39c66d",
          mascot: "ghost",
          pinned: true,
          archived: false,
          group: "  Work  ",
          mutedUntil: 0,
        },
        two: { color: "url(untrusted)", mascot: 3, mutedUntil: Infinity, pinned: "true" },
        three: null,
      }),
    ).toEqual({
      one: {
        color: "#39c66d",
        mascot: "ghost",
        pinned: true,
        archived: false,
        group: "Work",
        mutedUntil: 0,
      },
      two: {},
    });
  });
  it("expires timed mutes and keeps indefinite mutes until explicitly cleared", () => {
    expect(projectNotificationsMuted(undefined, 10)).toBe(false);
    expect(projectNotificationsMuted({ mutedUntil: 0 }, 10)).toBe(true);
    expect(projectNotificationsMuted({ mutedUntil: 20 }, 19)).toBe(true);
    expect(projectNotificationsMuted({ mutedUntil: 20 }, 20)).toBe(false);
    expect(projectNotificationsMuted({ mutedUntil: 1 }, 20)).toBe(false);
  });
});
