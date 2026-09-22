import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import type { EnvironmentId, ServerConfig } from "@t3tools/contracts";
import type {
  SidebarProjectGroupMember,
  SidebarProjectSnapshot,
} from "../../sidebarProjectGrouping";

const mocks = vi.hoisted(() => ({
  tabProps: null as Record<string, any> | null,
  updateCalls: [] as Array<any>,
  openCalls: [] as Array<any>,
  activateCalls: [] as Array<any>,
  toastCalls: [] as Array<any>,
  setAppearanceCalls: [] as Array<any>,
  appearances: {} as Record<string, any>,
  serverConfigs: new Map<string, any>(),
  navigate: vi.fn(),
}));

vi.mock("./TabGroupMenu", () => ({
  TabGroupMenu: (props: Record<string, any>) => {
    mocks.tabProps = props;
    return null;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mocks.navigate,
}));

vi.mock("../../state/use-atom-command", () => ({
  useAtomCommand: () => async (request: any) => {
    if (request?.input && "cwd" in request.input) {
      mocks.openCalls.push(request);
    } else {
      mocks.updateCalls.push(request);
    }
    return { _tag: "Success" };
  },
}));

vi.mock("../../state/entities", () => ({
  useServerConfigs: () => mocks.serverConfigs,
}));

vi.mock("../../fileContextMenu", () => ({
  useFileContextMenu: () => ({
    capabilities: {
      revealLabel: "Reveal in File Explorer",
      canOpenDefault: true,
      editorIds: ["file-manager", "vscode"],
    },
    activate: (...args: Array<unknown>) => {
      mocks.activateCalls.push(args);
      return Promise.resolve();
    },
  }),
  resolveFileContextMenuAbsolutePath: (target: { workspaceRoot?: string }) =>
    target.workspaceRoot ?? null,
}));

vi.mock("../../uiStateStore", () => ({
  useUiStateStore: (selector: (state: any) => unknown) =>
    selector({
      projectAppearanceByKey: mocks.appearances,
      setProjectAppearance: (...args: Array<unknown>) => {
        mocks.setAppearanceCalls.push(args);
      },
    }),
}));

vi.mock("../ui/toast", () => ({
  toastManager: {
    add: (...args: Array<unknown>) => {
      mocks.toastCalls.push(args);
    },
  },
}));

import {
  buildMemberFileItems,
  buildRenameMemberChoices,
  capabilitiesForMember,
} from "./ProjectMenu";

const envA = "env-a" as EnvironmentId;
const envB = "env-b" as EnvironmentId;

function member(
  key: string,
  environmentId: EnvironmentId,
  workspaceRoot: string,
  title: string,
  environmentLabel: string | null = null,
): SidebarProjectGroupMember {
  return {
    id: `proj-${key}`,
    title,
    workspaceRoot,
    environmentId,
    physicalProjectKey: key,
    environmentLabel,
  } as unknown as SidebarProjectGroupMember;
}

function snapshot(
  members: SidebarProjectGroupMember[],
  displayName: string,
): SidebarProjectSnapshot {
  const first = members[0];
  if (!first) {
    throw new Error("expected at least one member");
  }
  return {
    projectKey: "group-1",
    displayName,
    groupedProjectCount: members.length,
    environmentId: first.environmentId,
    workspaceRoot: first.workspaceRoot,
    memberProjects: members,
  } as unknown as SidebarProjectSnapshot;
}

function serverConfig(
  availableEditors: Array<string>,
  shellRevealInFileManager?: boolean,
  os = "windows",
): ServerConfig {
  return {
    availableEditors,
    shellRevealInFileManager,
    shellRevealInFileManagerKind: undefined,
    environment: { platform: { os } },
  } as unknown as ServerConfig;
}

function extraItem(tabProps: Record<string, any> | null, id: string): any {
  const item = (tabProps?.extraItems as Array<any> | undefined)?.find((entry) => entry?.id === id);
  if (!item) {
    throw new Error(`expected extra item ${id}`);
  }
  return item;
}

async function renderMenu(
  project: SidebarProjectSnapshot,
  onRenameMember?: (member: SidebarProjectGroupMember) => void,
): Promise<ReactTestRenderer> {
  const { ProjectMenu } = await import("./ProjectMenu");
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    const renameProps = onRenameMember !== undefined ? { onRenameMember } : {};
    renderer = create(
      <ProjectMenu
        project={project}
        position={{ x: 1, y: 2, trigger: { focus: () => {} } as any }}
        onClose={() => {}}
        onRemove={() => {}}
        onManageCheckouts={() => {}}
        {...renameProps}
      />,
    );
  });
  if (!renderer) {
    throw new Error("expected renderer");
  }
  return renderer;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  // Donor palette entries are hsl(): normalizeHex falls back through canvas.
  // No 2d context here, so it deterministically returns "#808080".
  vi.stubGlobal("HTMLElement", class {});
  vi.stubGlobal("document", {
    activeElement: null,
    createElement: () => ({ getContext: () => null }),
  });
  mocks.tabProps = null;
  mocks.updateCalls = [];
  mocks.openCalls = [];
  mocks.activateCalls = [];
  mocks.toastCalls = [];
  mocks.setAppearanceCalls = [];
  mocks.appearances = {};
  mocks.serverConfigs = new Map();
  mocks.navigate.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("capabilitiesForMember", () => {
  it("gates reveal on the member environment flag and file-manager", () => {
    expect(capabilitiesForMember(serverConfig(["file-manager"], true), envA).revealLabel).toBe(
      "Reveal in File Explorer",
    );
    expect(
      capabilitiesForMember(serverConfig(["file-manager"], false), envA).revealLabel,
    ).toBeUndefined();
    expect(capabilitiesForMember(serverConfig(["vscode"], true), envA).revealLabel).toBeUndefined();
    expect(
      capabilitiesForMember(serverConfig(["file-manager"], true), null).revealLabel,
    ).toBeUndefined();
    expect(capabilitiesForMember(undefined, envA)).toMatchObject({
      canOpenDefault: false,
      editorIds: [],
    });
  });

  it("words reveal per member OS", () => {
    expect(
      capabilitiesForMember(serverConfig(["file-manager"], true, "darwin"), envA).revealLabel,
    ).toBe("Reveal in Finder");
    expect(
      capabilitiesForMember(serverConfig(["file-manager"], true, "linux"), envA).revealLabel,
    ).toBe("Reveal in Files");
  });
});

describe("buildRenameMemberChoices", () => {
  it("lists every checkout by environment label or root", () => {
    const members = [
      member("key-a", envA, "/repo/a", "Alpha", "laptop"),
      member("key-b", envB, "/repo/b", "Alpha"),
    ];
    const choices = buildRenameMemberChoices(members);
    expect(choices).toHaveLength(2);
    expect(choices[0]).toMatchObject({ kind: "item", id: "rename-member:key-a", label: "laptop" });
    expect(choices[1]).toMatchObject({ kind: "item", id: "rename-member:key-b", label: "/repo/b" });
  });
});

describe("buildMemberFileItems", () => {
  it("gates each checkout on its own environment", () => {
    const members = [
      member("key-a", envA, "/repo/a", "Alpha", "laptop"),
      member("key-b", envB, "/repo/b", "Alpha", "server"),
    ];
    const capabilitiesByKey = new Map([
      ["key-a", capabilitiesForMember(serverConfig(["file-manager", "vscode"], true), envA)],
      ["key-b", capabilitiesForMember(serverConfig(["cursor"], false), envB)],
    ]);
    const absolutePathByKey = new Map([
      ["key-a", "/repo/a"],
      ["key-b", "/repo/b"],
    ]);

    const { openItem, editorItem, handlers } = buildMemberFileItems(
      members,
      capabilitiesByKey,
      absolutePathByKey,
    );

    const openLeaves = (openItem.submenu ?? []).filter(
      (entry): entry is Extract<typeof entry, { kind: "item" }> => entry.kind === "item",
    );
    expect(openLeaves.map((leaf) => [leaf.id, leaf.disabled])).toEqual([
      ["open:key-a", false],
      ["open:key-b", true],
    ]);
    expect(openItem.disabled).toBe(false);

    const editorBranches = (editorItem.submenu ?? []).filter(
      (entry): entry is Extract<typeof entry, { kind: "item" }> => entry.kind === "item",
    );
    // Each checkout carries only its own editors.
    expect(
      editorBranches.map((branch) => [
        branch.id,
        (branch.submenu ?? [])
          .filter((leaf) => leaf.kind === "item")
          .map((leaf) => (leaf as { id: string }).id),
      ]),
    ).toEqual([
      ["editor-member:key-a", ["editor:key-a:vscode"]],
      ["editor-member:key-b", ["editor:key-b:cursor"]],
    ]);
    expect(editorItem.disabled).toBe(false);

    // Every leaf resolves through the handler map; parents never do.
    for (const leafId of [
      "open:key-a",
      "open:key-b",
      "editor:key-a:vscode",
      "editor:key-b:cursor",
    ]) {
      expect(handlers.has(leafId)).toBe(true);
    }
    expect(handlers.has("open")).toBe(false);
    expect(handlers.has("editor")).toBe(false);
    expect(handlers.get("editor:key-b:cursor")).toMatchObject({
      editor: "cursor",
      reveal: false,
    });
    expect(
      (handlers.get("editor:key-b:cursor")?.member as SidebarProjectGroupMember).physicalProjectKey,
    ).toBe("key-b");
  });

  it("disables parents when no checkout can act and skips unresolvable roots", () => {
    const members = [member("key-a", envA, "/repo/a", "Alpha")];
    const capabilitiesByKey = new Map([
      ["key-a", capabilitiesForMember(serverConfig([], false), envA)],
    ]);
    const { openItem, editorItem } = buildMemberFileItems(
      members,
      capabilitiesByKey,
      new Map([["key-a", null]]),
    );
    expect(openItem.disabled).toBe(true);
    expect(openItem.submenu).toEqual([]);
    expect(editorItem.disabled).toBe(true);
    expect(editorItem.submenu).toEqual([]);
  });
});

describe("ProjectMenu rename (D4)", () => {
  it("single member commits through the inline field exactly once", async () => {
    const renderer = await renderMenu(
      snapshot([member("key-a", envA, "/repo/a", "Alpha")], "Alpha"),
    );
    try {
      expect(mocks.tabProps?.nameReadOnly).toBeFalsy();
      mocks.tabProps?.onRename("group-1", "Beta");
      await vi.waitFor(() => {
        expect(mocks.updateCalls).toHaveLength(1);
      });
      expect(mocks.updateCalls[0]).toMatchObject({
        environmentId: envA,
        input: { projectId: "proj-key-a", title: "Beta" },
      });
    } finally {
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it("single member ignores unchanged names", async () => {
    const renderer = await renderMenu(
      snapshot([member("key-a", envA, "/repo/a", "Alpha")], "Alpha"),
    );
    try {
      mocks.tabProps?.onRename("group-1", "  Alpha  ");
      await act(async () => {});
      expect(mocks.updateCalls).toHaveLength(0);
    } finally {
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it("multi member never bulk renames and routes per checkout", async () => {
    const onRenameMember = vi.fn();
    const members = [
      member("key-a", envA, "/repo/a", "Alpha", "laptop"),
      member("key-b", envB, "/repo/b", "Beta", "server"),
    ];
    const renderer = await renderMenu(snapshot(members, "Alpha (+1)"), onRenameMember);
    try {
      expect(mocks.tabProps?.nameReadOnly).toBe(true);
      const renameItem = extraItem(mocks.tabProps, "rename-member");
      expect(renameItem.label).toBe("Rename checkout…");
      expect((renameItem.submenu as Array<any>).map((entry) => entry.id)).toEqual([
        "rename-member:key-a",
        "rename-member:key-b",
      ]);

      // Inline commit is a no-op for grouped checkouts.
      mocks.tabProps?.onRename("group-1", "Bulk overwrite");
      await act(async () => {});
      expect(mocks.updateCalls).toHaveLength(0);

      mocks.tabProps?.onExtraPick("rename-member:key-b");
      expect(onRenameMember).toHaveBeenCalledTimes(1);
      expect(onRenameMember).toHaveBeenCalledWith(members[1]);
      expect(mocks.updateCalls).toHaveLength(0);
    } finally {
      await act(async () => {
        await renderer.unmount();
      });
    }
  });
});

describe("ProjectMenu file actions (D3)", () => {
  it("single member keeps the representative file-menu path", async () => {
    const renderer = await renderMenu(
      snapshot([member("key-a", envA, "/repo/a", "Alpha")], "Alpha"),
    );
    try {
      const openItem = extraItem(mocks.tabProps, "open");
      expect(openItem.submenu).toBeUndefined();

      mocks.tabProps?.onExtraPick("open");
      await vi.waitFor(() => {
        expect(mocks.activateCalls).toHaveLength(1);
      });
      expect(mocks.openCalls).toHaveLength(0);
    } finally {
      await act(async () => {
        await renderer.unmount();
      });
    }
  });

  it("multi member acts in each checkout environment", async () => {
    mocks.serverConfigs = new Map<string, any>([
      [envA, serverConfig(["file-manager", "vscode"], true, "windows")],
      [envB, serverConfig(["cursor"], false, "linux")],
    ]);
    const members = [
      member("key-a", envA, "/repo/a", "Alpha", "laptop"),
      member("key-b", envB, "/repo/b", "Alpha", "server"),
    ];
    const renderer = await renderMenu(snapshot(members, "Alpha (+1)"));
    try {
      const openItem = extraItem(mocks.tabProps, "open");
      const openLeaves = (openItem.submenu as Array<any>).filter((entry) => entry.kind === "item");
      expect(openLeaves.map((leaf: any) => [leaf.id, leaf.disabled])).toEqual([
        ["open:key-a", false],
        ["open:key-b", true],
      ]);

      mocks.tabProps?.onExtraPick("open:key-a");
      await vi.waitFor(() => {
        expect(mocks.openCalls).toHaveLength(1);
      });
      expect(mocks.openCalls[0]).toMatchObject({
        environmentId: envA,
        input: { cwd: "/repo/a", editor: "file-manager" },
      });
      expect(mocks.openCalls[0].input).not.toHaveProperty("reveal");

      mocks.tabProps?.onExtraPick("editor:key-b:cursor");
      await vi.waitFor(() => {
        expect(mocks.openCalls).toHaveLength(2);
      });
      // The acting checkout's environment wins, not the representative one.
      expect(mocks.openCalls[1]).toMatchObject({
        environmentId: envB,
        input: { cwd: "/repo/b", editor: "cursor" },
      });
      expect(mocks.activateCalls).toHaveLength(0);
    } finally {
      await act(async () => {
        await renderer.unmount();
      });
    }
  });
});
