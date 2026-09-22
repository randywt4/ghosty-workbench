import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { EDITORS, type EditorId, type EnvironmentId, type ServerConfig } from "@t3tools/contracts";
import { squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type {
  SidebarProjectGroupMember,
  SidebarProjectSnapshot,
} from "../../sidebarProjectGrouping";
import { useUiStateStore } from "../../uiStateStore";
import {
  projectAppearanceKey,
  projectNotificationsMuted,
  resolveProjectAppearance,
  type ProjectAppearance,
} from "../../projectAppearance";
import { projectEnvironment } from "../../state/projects";
import { shellEnvironment } from "../../state/shell";
import { useAtomCommand } from "../../state/use-atom-command";
import { useServerConfigs } from "../../state/entities";
import {
  resolveFileContextMenuAbsolutePath,
  useFileContextMenu,
  type FileContextMenuCapabilities,
  type FileContextMenuTarget,
} from "../../fileContextMenu";
import {
  revealInFileExplorerLabelForKind,
  revealInFileExplorerLabelForOs,
} from "../preview/fileExplorerLabel";
import { toastManager } from "../ui/toast";
import { TabGroupMenu, type TabGroupMenuExtraItem } from "./TabGroupMenu";
import { TAB_GROUP_COLORS } from "./tabGroupColors";
import { normalizeHex } from "./colorUtils";
import type { ExplorerMenuItem } from "./ExplorerMenu";
import {
  AppWindow,
  Archive,
  BellOff,
  FolderOpen,
  FolderTree,
  PenLine,
  Pin,
  PinOff,
  Settings,
  Trash2,
} from "./icons";

export interface ProjectMenuPosition {
  x: number;
  y: number;
  trigger: HTMLButtonElement;
}

export interface MemberFileAction {
  member: SidebarProjectGroupMember;
  editor: EditorId;
  reveal: boolean;
}

/**
 * Per-environment file capabilities for one member checkout. Mirrors the
 * derivation owned by fileContextMenu.ts (useFileContextMenu) so each member
 * is gated on its own environment without hooks-in-loop reads.
 */
export function capabilitiesForMember(
  serverConfig: ServerConfig | undefined,
  environmentId: EnvironmentId | null,
): FileContextMenuCapabilities {
  const availableEditors = serverConfig?.availableEditors ?? [];
  return {
    revealLabel:
      environmentId !== null &&
      serverConfig?.shellRevealInFileManager === true &&
      serverConfig.availableEditors.includes("file-manager")
        ? serverConfig.shellRevealInFileManagerKind === undefined
          ? revealInFileExplorerLabelForOs(serverConfig.environment.platform.os)
          : revealInFileExplorerLabelForKind(serverConfig.shellRevealInFileManagerKind)
        : undefined,
    canOpenDefault: availableEditors.includes("file-manager"),
    editorIds: availableEditors,
  };
}

function editorLabel(editorId: EditorId): string {
  return EDITORS.find((editor) => editor.id === editorId)?.label ?? editorId;
}

/** Per-checkout choices for the multi-member "Rename checkout…" submenu. */
export function buildRenameMemberChoices(
  members: readonly SidebarProjectGroupMember[],
): ExplorerMenuItem[] {
  return members.map((member) => ({
    kind: "item" as const,
    id: `rename-member:${member.physicalProjectKey}`,
    label: member.environmentLabel ?? member.workspaceRoot,
  }));
}

/**
 * Multi-member Reveal / Open-in-editor entries. Each checkout is gated on its
 * own environment; leaf ids resolve through the returned handler map (exact
 * match, no id parsing) to the correct member environment.
 */
export function buildMemberFileItems(
  members: readonly SidebarProjectGroupMember[],
  capabilitiesByKey: ReadonlyMap<string, FileContextMenuCapabilities>,
  absolutePathByKey: ReadonlyMap<string, string | null>,
): {
  openItem: TabGroupMenuExtraItem;
  editorItem: TabGroupMenuExtraItem;
  handlers: ReadonlyMap<string, MemberFileAction>;
} {
  const handlers = new Map<string, MemberFileAction>();
  const openChildren: ExplorerMenuItem[] = [];
  const editorChildren: ExplorerMenuItem[] = [];

  for (const member of members) {
    if (absolutePathByKey.get(member.physicalProjectKey) == null) {
      continue;
    }
    const capabilities = capabilitiesByKey.get(member.physicalProjectKey) ?? {
      revealLabel: undefined,
      canOpenDefault: false,
      editorIds: [],
    };
    const label = member.environmentLabel ?? member.workspaceRoot;

    const openId = `open:${member.physicalProjectKey}`;
    handlers.set(openId, { member, editor: "file-manager", reveal: false });
    openChildren.push({
      kind: "item" as const,
      id: openId,
      label,
      disabled: !capabilities.canOpenDefault,
    });

    const editors = capabilities.editorIds.filter((id) => id !== "file-manager");
    if (editors.length > 0) {
      const memberId = `editor-member:${member.physicalProjectKey}`;
      const editorLeaves: ExplorerMenuItem[] = [];
      for (const editor of editors) {
        const leafId = `editor:${member.physicalProjectKey}:${editor}`;
        handlers.set(leafId, { member, editor, reveal: false });
        editorLeaves.push({ kind: "item" as const, id: leafId, label: editorLabel(editor) });
      }
      editorChildren.push({ kind: "item" as const, id: memberId, label, submenu: editorLeaves });
    }
  }

  return {
    openItem: {
      id: "open",
      label: "Reveal in File Explorer",
      icon: FolderOpen,
      disabled: !openChildren.some((child) => child.kind === "item" && !child.disabled),
      submenu: openChildren,
    },
    editorItem: {
      id: "editor",
      label: "Open in editor",
      icon: AppWindow,
      disabled: editorChildren.length === 0,
      submenu: editorChildren,
    },
    handlers,
  };
}

/** T3 action adapter for the actual MonoCode project appearance/menu component. */
export function ProjectMenu({
  project,
  position,
  onClose,
  onRemove,
  onManageCheckouts,
  onRenameMember,
}: {
  project: SidebarProjectSnapshot;
  position: ProjectMenuPosition;
  onClose: () => void;
  onRemove: (member: SidebarProjectGroupMember) => void;
  onManageCheckouts: () => void;
  /** Multi-member "Rename checkout…" target. Main wires this to openProjectRenameDialog. */
  onRenameMember?: (member: SidebarProjectGroupMember) => void;
}) {
  const navigate = useNavigate();
  const updateProject = useAtomCommand(projectEnvironment.update, { reportFailure: false });
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });
  const serverConfigs = useServerConfigs();
  const [saving, setSaving] = useState(false);
  const [newGroup, setNewGroup] = useState<string | null>(null);
  const appearances = useUiStateStore((state) => state.projectAppearanceByKey);
  const appearance = resolveProjectAppearance(project, appearances);
  const setAppearance = useUiStateStore((state) => state.setProjectAppearance);
  const fileMenu = useFileContextMenu(project.environmentId);
  const isMultiMember = project.memberProjects.length > 1;
  const capabilitiesByKey = useMemo(
    () =>
      new Map(
        project.memberProjects.map((member) => [
          member.physicalProjectKey,
          capabilitiesForMember(serverConfigs.get(member.environmentId), member.environmentId),
        ]),
      ),
    [project.memberProjects, serverConfigs],
  );
  const absolutePathByKey = useMemo(
    () =>
      new Map(
        project.memberProjects.map((member) => {
          const target: FileContextMenuTarget = {
            environmentId: member.environmentId,
            filePath: member.workspaceRoot,
            workspaceRoot: member.workspaceRoot,
          };
          return [member.physicalProjectKey, resolveFileContextMenuAbsolutePath(target)];
        }),
      ),
    [project.memberProjects],
  );
  const memberFileMenu = useMemo(
    () =>
      isMultiMember
        ? buildMemberFileItems(project.memberProjects, capabilitiesByKey, absolutePathByKey)
        : null,
    [isMultiMember, project.memberProjects, capabilitiesByKey, absolutePathByKey],
  );
  const groupNames = [
    ...new Set(
      Object.values(appearances ?? {}).flatMap((item) => (item.group ? [item.group] : [])),
    ),
  ].sort();
  const patch = (next: Partial<ProjectAppearance>) => {
    for (const member of project.memberProjects) setAppearance(projectAppearanceKey(member), next);
  };
  useEffect(
    () => () => {
      position.trigger.focus();
    },
    [position.trigger],
  );
  // Single-member only: the inline name field commits one checkout. A logical
  // project with several checkouts renames per checkout through the "Rename
  // checkout…" submenu (onRenameMember); bulk overwrite is never attempted.
  const rename = async (title: string) => {
    if (project.memberProjects.length > 1) return;
    const single = project.memberProjects[0];
    if (!single) return;
    const value = title.trim();
    if (!value || saving) return;
    if (single.title === value) return;
    setSaving(true);
    try {
      const result = await updateProject({
        environmentId: single.environmentId,
        input: { projectId: single.id, title: value },
      });
      if (result._tag === "Failure") {
        const error = squashAtomCommandFailure(result);
        toastManager.add({
          type: "error",
          title: `Could not rename ${single.title}`,
          description: error instanceof Error ? error.message : "Project update failed.",
        });
      }
    } finally {
      setSaving(false);
    }
  };
  const openPath = (action: Parameters<typeof fileMenu.activate>[0]) => {
    void fileMenu.activate(action, {
      environmentId: project.environmentId,
      workspaceRoot: project.workspaceRoot,
      filePath: project.workspaceRoot,
    });
    onClose();
  };
  // Member-scoped activation for multi-member checkouts: same guards as the
  // file-menu owner, but against the acting member's own capabilities and
  // environment instead of the representative one.
  const activateMemberPath = async (
    member: SidebarProjectGroupMember,
    editor: EditorId,
    reveal: boolean,
  ) => {
    const capabilities = capabilitiesByKey.get(member.physicalProjectKey);
    if (!reveal && editor !== "file-manager" && !capabilities?.editorIds.includes(editor)) return;
    const absolutePath = absolutePathByKey.get(member.physicalProjectKey) ?? null;
    if (absolutePath === null) return;
    const result = await openInEditor({
      environmentId: member.environmentId,
      input: { cwd: absolutePath, editor, ...(reveal ? { reveal: true } : {}) },
    });
    if (result._tag !== "Failure") return;
    toastManager.add({
      type: "error",
      title:
        editor === "file-manager" && !reveal
          ? "Could not open file"
          : reveal
            ? "Unable to reveal file"
            : `Could not open in ${editorLabel(editor)}`,
      description: absolutePath,
    });
  };
  const colorIndex = TAB_GROUP_COLORS.findIndex(
    (value) => normalizeHex(value) === appearance?.color?.toLowerCase(),
  );
  const extraItems: TabGroupMenuExtraItem[] = [
    ...(isMultiMember
      ? [
          {
            id: "rename-member",
            label: "Rename checkout…",
            icon: PenLine,
            submenu: buildRenameMemberChoices(project.memberProjects),
          } satisfies TabGroupMenuExtraItem,
        ]
      : []),
    {
      id: "group",
      label: "Move to group",
      icon: FolderTree,
      submenu: [
        { kind: "item", id: "group-new", label: "New group…" },
        ...groupNames.map((group) => ({
          kind: "item" as const,
          id: `group:${group}`,
          label: group,
          checked: appearance?.group === group,
        })),
        { kind: "item", id: "group:", label: "Ungrouped", checked: !appearance?.group },
      ],
    },
    {
      id: "pin",
      label: appearance?.pinned ? "Unpin project" : "Pin project",
      icon: appearance?.pinned ? PinOff : Pin,
    },
    ...(isMultiMember && memberFileMenu
      ? [memberFileMenu.openItem, memberFileMenu.editorItem]
      : ([
          {
            id: "open",
            label: "Reveal in File Explorer",
            icon: FolderOpen,
            disabled: !fileMenu.capabilities.canOpenDefault,
          },
          {
            id: "editor",
            label: "Open in editor",
            icon: AppWindow,
            disabled:
              fileMenu.capabilities.editorIds.filter((id) => id !== "file-manager").length === 0,
            submenu: fileMenu.capabilities.editorIds
              .filter((id) => id !== "file-manager")
              .map((id) => ({
                kind: "item",
                id: `editor:${id}`,
                label: EDITORS.find((editor) => editor.id === id)?.label ?? id,
              })),
          },
        ] satisfies TabGroupMenuExtraItem[])),
    {
      id: "mute",
      label: projectNotificationsMuted(appearance) ? "Notifications muted" : "Mute notifications",
      icon: BellOff,
      sepBefore: true,
      submenu: [
        { kind: "item", id: "unmute", label: "Unmute" },
        { kind: "item", id: "mute-hour", label: "For 1 hour" },
        { kind: "item", id: "mute-day", label: "For 24 hours" },
        { kind: "item", id: "mute-always", label: "Until I turn it back on" },
      ],
    },
    { id: "notifications", label: "Notification settings…", icon: Settings },
    { id: "settings", label: "Project settings…", icon: Settings, sepBefore: true },
    {
      id: "archive",
      label: appearance?.archived ? "Restore project" : "Archive project",
      icon: Archive,
    },
    {
      id: "remove",
      label: project.memberProjects.length === 1 ? "Delete project…" : "Remove project entry…",
      icon: Trash2,
      danger: true,
      ...(project.memberProjects.length > 1
        ? {
            submenu: project.memberProjects.map((member) => ({
              kind: "item" as const,
              id: `remove:${member.physicalProjectKey}`,
              label: member.environmentLabel ?? member.workspaceRoot,
              danger: true,
            })),
          }
        : {}),
    },
  ];
  const pick = (id: string) => {
    const memberAction = memberFileMenu?.handlers.get(id);
    if (memberAction) {
      void activateMemberPath(memberAction.member, memberAction.editor, memberAction.reveal);
      onClose();
      return;
    }
    if (id === "group-new") {
      setNewGroup("");
      return false;
    }
    if (id.startsWith("group:")) patch({ group: id.slice(6) });
    else if (id === "pin") patch({ pinned: !appearance?.pinned });
    else if (id === "archive") patch({ archived: !appearance?.archived });
    else if (id === "unmute") patch({ mutedUntil: 1 });
    else if (id === "mute-hour") patch({ mutedUntil: Date.now() + 3600000 });
    else if (id === "mute-day") patch({ mutedUntil: Date.now() + 86400000 });
    else if (id === "mute-always") patch({ mutedUntil: 0 });
    else if (id === "notifications") void navigate({ to: "/settings/general" });
    else if (id === "settings") onManageCheckouts();
    else if (id === "remove") onRemove(project.memberProjects[0]!);
    else if (id.startsWith("remove:")) {
      const member = project.memberProjects.find(
        (entry) => entry.physicalProjectKey === id.slice(7),
      );
      if (member) onRemove(member);
    } else if (id.startsWith("rename-member:")) {
      const member = project.memberProjects.find(
        (entry) => entry.physicalProjectKey === id.slice("rename-member:".length),
      );
      if (member) onRenameMember?.(member);
    } else if (!isMultiMember && (id === "open" || id.startsWith("editor:")))
      openPath(id as Parameters<typeof fileMenu.activate>[0]);
  };
  return (
    <TabGroupMenu
      x={position.x}
      y={position.y}
      groupId={project.projectKey}
      label={project.displayName}
      colorIndex={colorIndex < 0 ? null : colorIndex}
      customColor={colorIndex < 0 ? (appearance?.color ?? null) : null}
      currentColor={appearance?.color ?? TAB_GROUP_COLORS[0]}
      mascotName={appearance?.mascot ?? null}
      mascotProject={projectAppearanceKey(project)}
      onRename={(_key, name) => {
        void rename(name);
      }}
      nameReadOnly={isMultiMember}
      onColorChange={(_key, index) => patch({ color: normalizeHex(TAB_GROUP_COLORS[index ?? 0]!) })}
      onCustomColorChange={(_key, color) => patch({ color })}
      onMascotChange={(_key, name) => {
        if (name) patch({ mascot: name });
      }}
      onPick={() => {}}
      onClose={onClose}
      showActions={false}
      ariaLabel={`${project.displayName} project options`}
      extraItems={extraItems}
      onExtraPick={pick}
      footer={
        newGroup !== null ? (
          <form
            className="mt-2"
            onSubmit={(event) => {
              event.preventDefault();
              const group = newGroup.trim();
              if (group) {
                patch({ group });
                onClose();
              }
            }}
          >
            <input
              autoFocus
              aria-label="New project group name"
              placeholder="Group name, then Enter"
              maxLength={80}
              value={newGroup}
              onChange={(event) => setNewGroup(event.target.value)}
              className="w-full rounded-lg border border-content/10 bg-content/5 px-2.5 py-1.5 text-[13px] text-content outline-none ring-monocode-accent/40 focus:ring-1"
            />
          </form>
        ) : null
      }
    />
  );
}
