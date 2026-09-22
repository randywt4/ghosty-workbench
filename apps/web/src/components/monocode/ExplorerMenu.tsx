import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { LAYER } from "./layers";
import { Check, ChevronRight } from "./icons";
import { Popover } from "./Popover";

type MenuAction = {
  kind: "item";
  id: string;
  label: string;
  description?: string | undefined;
  shortcut?: string | undefined;
  disabled?: boolean | undefined;
  danger?: boolean | undefined;
  checked?: boolean | undefined;
  /** Optional leading icon, rendered with the donor MenuRow structure. */
  icon?: ReactNode | undefined;
};

export type ExplorerMenuItem =
  | { kind: "sep" }
  | { kind: "header"; label: string }
  | (MenuAction & { submenu?: ExplorerMenuItem[] | undefined });

type Props = (
  | { x: number; y: number; anchor?: never }
  | { anchor: HTMLElement; x?: never; y?: never }
) & {
  ownerId?: string | undefined;
  onBack?: (() => void) | undefined;
  items: ExplorerMenuItem[];
  ariaLabel?: string | undefined;
  header?: ReactNode | undefined;
  width?: number | undefined;
  onPick: (id: string) => void;
  onClose: () => void;
  onMouseEnter?: (() => void) | undefined;
  onMouseLeave?: (() => void) | undefined;
  /**
   * When true, every portaled menu level carries
   * `data-file-tree-context-menu-root="true"` so the Pierre file tree's
   * capture-phase composition does not dismiss its context while this
   * shared menu is open. Project submenus leave this false to preserve
   * their accepted appearance and behavior.
   */
  fileTreeMenuRoot?: boolean | undefined;
};

const MENU_WIDTH = 228;

function itemIndexAt(items: ExplorerMenuItem[], start: number, dir: 1 | -1): number {
  let i = start;
  while (i >= 0 && i < items.length) {
    const item = items[i];
    if (item?.kind === "item") return i;
    i += dir;
  }
  return start;
}

export function ExplorerMenu({
  x,
  y,
  anchor,
  ownerId,
  onBack,
  items,
  ariaLabel = "File actions",
  header,
  width = MENU_WIDTH,
  onPick,
  onClose,
  onMouseEnter,
  onMouseLeave,
  fileTreeMenuRoot = false,
}: Props) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [active, setActive] = useState(() => itemIndexAt(items, 0, 1));
  const [submenu, setSubmenu] = useState<{
    index: number;
    anchor: HTMLButtonElement;
  } | null>(null);
  const submenuItem = submenu ? items[submenu.index] : undefined;
  const submenuItems = submenuItem?.kind === "item" ? submenuItem.submenu : undefined;

  const cancelClose = () => {
    if (closeTimer.current != null) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  };

  const closeSubmenu = () => {
    cancelClose();
    const focused = document.activeElement;
    if (
      focused instanceof HTMLElement &&
      focused.closest("[data-explorer-menu]") &&
      !menuRef.current?.contains(focused)
    ) {
      menuRef.current?.focus();
    }
    setSubmenu(null);
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(closeSubmenu, 180);
  };

  useEffect(() => cancelClose, []);

  useEffect(() => {
    if (!fileTreeMenuRoot) return;
    // Popover portals the glass frame (monocode-surface) with the menu as its
    // child; the file tree's capture-phase composition checks the portaled
    // root, so mirror the marker onto the outer frame for border clicks.
    const inner = menuRef.current;
    const outer = inner?.parentElement;
    if (outer && outer.classList.contains("monocode-surface")) {
      outer.setAttribute("data-file-tree-context-menu-root", "true");
    }
  }, [fileTreeMenuRoot]);

  const ids = useMemo(
    () =>
      items.flatMap((item, index) =>
        item.kind === "item" ? [{ index, id: item.id, disabled: !!item.disabled }] : [],
      ),
    [items],
  );

  const move = (dir: 1 | -1) => {
    const from = ids.findIndex((item) => item.index === active);
    const next = ids[(from + dir + ids.length) % ids.length];
    if (next) setActive(next.index);
  };

  const onMenuKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      if (submenu) {
        e.preventDefault();
        e.stopPropagation();
        closeSubmenu();
        return;
      }
      if (onBack) {
        e.preventDefault();
        e.stopPropagation();
        onBack();
        return;
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      move(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      move(-1);
      return;
    }
    if (e.key === "Enter" || e.key === " " || e.key === "ArrowRight") {
      e.preventDefault();
      // Portaled submenu events bubble through the React tree, so a nested
      // navigation/selection would otherwise drive ancestor levels (and any
      // global list shortcuts) alongside the focused submenu.
      e.stopPropagation();
      const item = items[active];
      if (item?.kind !== "item" || item.disabled) return;
      if (item.submenu?.length) {
        const anchorEl = menuRef.current?.querySelector<HTMLButtonElement>(
          `[data-menu-index="${active}"]`,
        );
        if (anchorEl) {
          cancelClose();
          setSubmenu({ index: active, anchor: anchorEl });
        }
      } else if (e.key !== "ArrowRight") {
        onPick(item.id);
      }
    }
  };

  const renderItem = (
    item: MenuAction & { submenu?: ExplorerMenuItem[] | undefined },
    index: number,
  ) => {
    const highlighted = index === active;
    const hasSubmenu = !!item.submenu?.length;
    return (
      <button
        key={item.id}
        id={`${menuId}-${index}`}
        data-menu-index={index}
        type="button"
        role={item.checked == null ? "menuitem" : "menuitemcheckbox"}
        aria-checked={item.checked}
        aria-haspopup={hasSubmenu ? "menu" : undefined}
        aria-expanded={hasSubmenu ? submenu?.index === index : undefined}
        disabled={item.disabled}
        onMouseDown={(e) => e.preventDefault()}
        onMouseEnter={(e) => {
          cancelClose();
          setActive(index);
          if (hasSubmenu && !item.disabled) {
            setSubmenu({ index, anchor: e.currentTarget });
          } else {
            closeSubmenu();
          }
        }}
        onClick={(e) => {
          if (item.disabled) return;
          if (hasSubmenu) {
            cancelClose();
            setSubmenu({ index, anchor: e.currentTarget });
          } else {
            onPick(item.id);
          }
        }}
        className={`flex ${item.description ? "py-1.5" : "h-7"} w-full items-center gap-3 rounded-lg px-2 text-left text-[13px] leading-none ${
          item.disabled
            ? "text-content/30"
            : item.danger
              ? highlighted
                ? "bg-red-500/20 text-red-300"
                : "text-red-300/90 hover:bg-red-500/15"
              : highlighted
                ? "bg-selection text-content"
                : "text-content hover:bg-content/5"
        }`}
      >
        {item.icon ? (
          <span className="grid shrink-0 place-items-center [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-content/55">
            {item.icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate leading-label">{item.label}</span>
          {item.description ? (
            <span className="mt-1 block text-[11px] leading-snug text-content/50">
              {item.description}
            </span>
          ) : null}
        </span>
        {hasSubmenu ? (
          <ChevronRight className="size-3.5 shrink-0 text-content/50" strokeWidth={1.75} />
        ) : item.checked ? (
          <Check className="size-3.5 shrink-0" strokeWidth={2.25} />
        ) : item.shortcut ? (
          <span className="shrink-0 text-[11px] text-content/40">{item.shortcut}</span>
        ) : null}
      </button>
    );
  };

  const fileTreeAttrs = fileTreeMenuRoot
    ? ({ "data-file-tree-context-menu-root": "true" } as const)
    : undefined;

  return (
    <>
      <Popover
        ref={menuRef}
        anchor={anchor ?? { x: x ?? 0, y: y ?? 0 }}
        side={anchor ? "right" : undefined}
        gap={anchor ? 4 : 0}
        layer={anchor ? LAYER.submenu : undefined}
        data-menu-owner={ownerId}
        width={width}
        autoFocus
        onDismiss={(reason) => {
          if (reason === "escape" && submenu) closeSubmenu();
          else onClose();
        }}
        ignore="[data-explorer-menu]"
        data-explorer-menu={menuId}
        {...fileTreeAttrs}
        role="menu"
        tabIndex={-1}
        aria-label={ariaLabel}
        aria-activedescendant={`${menuId}-${active}`}
        onKeyDown={onMenuKey}
        onContextMenu={(e) => e.preventDefault()}
        onMouseEnter={() => {
          cancelClose();
          onMouseEnter?.();
        }}
        onMouseLeave={() => {
          if (submenu) scheduleClose();
          onMouseLeave?.();
        }}
        className="overflow-y-auto overscroll-none p-1"
      >
        {header ? (
          <>
            {header}
            <div role="separator" className="my-1 h-px bg-content/10" />
          </>
        ) : null}
        {items.map((item, index) => {
          if (item.kind === "sep") {
            return (
              <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-content/10" />
            );
          }
          if (item.kind === "header") {
            return (
              <div
                key={`header-${index}`}
                className="px-2 py-1.5 text-[11px] font-medium text-content/50"
              >
                {item.label}
              </div>
            );
          }
          return renderItem(item, index);
        })}
      </Popover>
      {submenu && submenuItems && submenuItem?.kind === "item" ? (
        <ExplorerMenu
          anchor={submenu.anchor}
          ownerId={ownerId}
          ariaLabel={submenuItem.label}
          items={submenuItems}
          onPick={onPick}
          onClose={closeSubmenu}
          onBack={closeSubmenu}
          onMouseEnter={cancelClose}
          onMouseLeave={scheduleClose}
          fileTreeMenuRoot={fileTreeMenuRoot}
        />
      ) : null}
    </>
  );
}
