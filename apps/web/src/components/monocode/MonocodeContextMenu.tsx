import { useMemo, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { ContextMenuItem } from "@t3tools/contracts";
import { ExplorerMenu, type ExplorerMenuItem } from "./ExplorerMenu";
import {
  Archive,
  CheckCircle,
  Clock,
  Copy,
  Folder,
  FolderTree,
  GitBranch,
  MessageSquarePlus,
  PenLine,
  Pin,
  PinOff,
  RefreshCw,
  Settings,
  Trash2,
} from "./icons";

/**
 * Shared application context-menu bridge.
 *
 * Routes `api.contextMenu.show()` to the actual MonoCode donor renderer
 * (ExplorerMenu + Popover + GlassBackdrop) so sessions, multi-select, files,
 * right-panel tabs and every other caller share one look instead of the
 * native OS menu in Electron or the old DOM fallback elsewhere.
 *
 * T3 feature semantics stay: original item IDs resolve, disabled and
 * destructive states are preserved, separators and headers are kept, and
 * nested `children` are supported to their actual depth (never silently
 * dropped). Only one menu exists at a time; a new show supersedes the old
 * with a null resolution so promises never leak.
 */

function mapContextMenuIcon(name: string | undefined): ReactNode | undefined {
  switch (name) {
    case "archive":
      return <Archive strokeWidth={1.75} />;
    case "pin":
      return <Pin strokeWidth={1.75} />;
    case "pin-off":
      return <PinOff strokeWidth={1.75} />;
    case "pencil":
      return <PenLine strokeWidth={1.75} />;
    case "copy":
      return <Copy strokeWidth={1.75} />;
    case "folder":
      return <Folder strokeWidth={1.75} />;
    case "folder-tree":
      return <FolderTree strokeWidth={1.75} />;
    case "git-branch":
      return <GitBranch strokeWidth={1.75} />;
    case "settings":
      return <Settings strokeWidth={1.75} />;
    case "trash":
      return <Trash2 strokeWidth={1.75} />;
    case "clock":
      return <Clock strokeWidth={1.75} />;
    case "circle-check":
      return <CheckCircle strokeWidth={1.75} />;
    case "refresh-cw":
      return <RefreshCw strokeWidth={1.75} />;
    case "message-square-plus":
      return <MessageSquarePlus strokeWidth={1.75} />;
    default:
      // `hash` (Thread ID) and `mail-open` (Mark unread) have no direct
      // MonoCode chrome equivalent; omit the icon rather than invent one.
      // Labels, IDs and actions are still preserved.
      return undefined;
  }
}

/**
 * Converts contract items to donor menu items, preserving IDs, disabled,
 * destructive (leaf-only, matching the old fallback), headers, separators
 * and full nested depth.
 */
export function toExplorerMenuItems<T extends string>(
  items: readonly ContextMenuItem<T>[],
): ExplorerMenuItem[] {
  const convertLevel = (entries: readonly ContextMenuItem<T>[]): ExplorerMenuItem[] => {
    const out: ExplorerMenuItem[] = [];
    for (const entry of entries) {
      if (entry.separatorBefore === true && out.length > 0 && out[out.length - 1]?.kind !== "sep") {
        out.push({ kind: "sep" });
      }
      if (entry.header === true) {
        out.push({ kind: "header", label: entry.label });
        continue;
      }
      const hasChildren = Array.isArray(entry.children) && entry.children.length > 0;
      // Match the old fallback: only leaves render destructive red.
      const danger = !hasChildren && (entry.destructive === true || entry.id === ("delete" as T));
      const icon = typeof entry.icon === "string" ? mapContextMenuIcon(entry.icon) : undefined;
      if (hasChildren) {
        out.push({
          kind: "item",
          id: entry.id,
          label: entry.label,
          disabled: entry.disabled,
          danger: entry.destructive === true ? true : undefined,
          icon,
          submenu: convertLevel(entry.children!),
        });
      } else {
        out.push({
          kind: "item",
          id: entry.id,
          label: entry.label,
          disabled: entry.disabled,
          danger: danger ? true : undefined,
          icon,
        });
      }
    }
    return out;
  };
  return convertLevel(items);
}

function MonocodeContextMenuHost<T extends string>({
  items,
  position,
  onPick,
  onClose,
}: {
  items: readonly ContextMenuItem<T>[];
  position: { x: number; y: number } | undefined;
  onPick: (id: T) => void;
  onClose: () => void;
}) {
  const explorerItems = useMemo(() => toExplorerMenuItems(items), [items]);
  return (
    <ExplorerMenu
      x={position?.x ?? 0}
      y={position?.y ?? 0}
      items={explorerItems}
      ariaLabel="Context menu"
      onPick={(id) => onPick(id as T)}
      onClose={onClose}
      fileTreeMenuRoot
    />
  );
}

let activeDismiss: (() => void) | null = null;
let activeRoot: Root | null = null;
let activeContainer: HTMLDivElement | null = null;

export function isMonocodeContextMenuOpen(): boolean {
  return activeDismiss !== null;
}

/**
 * Closes the open shared menu, resolving its show() with null like an
 * outside click or Escape. No-op when none is open.
 */
export function dismissMonocodeContextMenu(): void {
  const dismiss = activeDismiss;
  activeDismiss = null;
  dismiss?.();
}

/**
 * Shows the shared MonoCode menu and resolves with the selected original ID
 * or null on cancel, outside click or Escape. A new show supersedes any open
 * menu (prior resolves null) so callers never hold duplicate promises.
 */
export function showMonocodeContextMenu<T extends string>(
  items: readonly ContextMenuItem<T>[],
  position?: { x: number; y: number },
): Promise<T | null> {
  if (activeDismiss) {
    const prior = activeDismiss;
    activeDismiss = null;
    prior();
  }
  if (typeof document === "undefined") {
    return Promise.resolve(null);
  }
  let previouslyFocusedElement =
    document.activeElement instanceof HTMLElement ? document.activeElement : null;
  // Pierre's keyboard target lives inside a shadow root, not on its host.
  while (previouslyFocusedElement?.shadowRoot?.activeElement instanceof HTMLElement) {
    previouslyFocusedElement = previouslyFocusedElement.shadowRoot.activeElement;
  }

  return new Promise<T | null>((resolve) => {
    let isDisposed = false;
    const container = document.createElement("div");
    container.setAttribute("data-monocode-context-menu-host", "true");
    document.body.appendChild(container);
    const root = createRoot(container);
    activeRoot = root;
    activeContainer = container;

    const cleanup = (result: T | null) => {
      if (isDisposed) {
        return;
      }
      isDisposed = true;
      if (activeDismiss === dismiss) {
        activeDismiss = null;
      }
      // Capture focus BEFORE unmount: once the portaled menu is removed,
      // document.activeElement has already fallen back to body, so a
      // post-unmount read can never see focus inside the menu and Escape
      // would fail to restore the trigger.
      const focusedAtClose = document.activeElement;
      const focusInsideMenu =
        focusedAtClose instanceof HTMLElement &&
        focusedAtClose.closest("[data-explorer-menu],[data-file-tree-context-menu-root]") !== null;
      const restoreTarget =
        focusInsideMenu && previouslyFocusedElement?.isConnected ? previouslyFocusedElement : null;
      try {
        root.unmount();
      } catch {
        // Unmount after a superseding show already removed the host.
      }
      container.remove();
      if (activeRoot === root) {
        activeRoot = null;
      }
      if (activeContainer === container) {
        activeContainer = null;
      }
      restoreTarget?.focus({ preventScroll: true });
      resolve(result);
    };

    const dismiss = () => cleanup(null);
    activeDismiss = dismiss;

    root.render(
      <MonocodeContextMenuHost
        items={items}
        position={position}
        onPick={(id) => cleanup(id)}
        onClose={() => cleanup(null)}
      />,
    );
  });
}

/** Test-only reset: unmounts any host without resolving through the UI. */
export function resetMonocodeContextMenuForTests(): void {
  dismissMonocodeContextMenu();
}
