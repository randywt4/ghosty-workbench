import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";

vi.mock("./Popover", () => ({
  Popover: (props: {
    children?: unknown;
    onKeyDown?: (event: unknown) => void;
    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    role?: string;
    tabIndex?: number;
    [key: string]: unknown;
  }) => (
    <div
      onKeyDown={props.onKeyDown as never}
      onMouseEnter={props.onMouseEnter as never}
      onMouseLeave={props.onMouseLeave as never}
      role={props.role}
      tabIndex={props.tabIndex}
      aria-label={props["aria-label"] as string | undefined}
      aria-activedescendant={props["aria-activedescendant"] as string | undefined}
      data-explorer-menu={props["data-explorer-menu"] as string | undefined}
      data-file-tree-context-menu-root={
        props["data-file-tree-context-menu-root"] as string | undefined
      }
    >
      {props.children as never}
    </div>
  ),
}));

import { ExplorerMenu } from "./ExplorerMenu";

class FakeKeyHTMLElement {
  closest(_selector: string): unknown {
    return null;
  }
}

function fakeKeyEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

function menuDivs(renderer: ReactTestRenderer | undefined) {
  if (!renderer) {
    throw new Error("expected renderer");
  }
  // Host divs only: the mocked Popover composite carries the same role prop.
  return renderer.root.findAll(
    (node) => typeof node.type === "string" && node.type === "div" && node.props.role === "menu",
  );
}

function menuButtons(renderer: ReactTestRenderer | undefined, menuIndex = 0) {
  const menus = menuDivs(renderer);
  const menu = menus[menuIndex];
  if (!menu) {
    throw new Error("expected menu");
  }
  return menu.findAll(
    (node) =>
      typeof node.type === "string" &&
      node.type === "button" &&
      (node.props.role === "menuitem" || node.props.role === "menuitemcheckbox"),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("HTMLElement", FakeKeyHTMLElement);
  vi.stubGlobal("document", { activeElement: null });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("ExplorerMenu keyboard containment", () => {
  it("stops propagation for navigation and selection keys", async () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <ExplorerMenu
          x={0}
          y={0}
          items={[
            { kind: "item", id: "rename", label: "Rename" },
            { kind: "item", id: "delete", label: "Delete", danger: true },
          ]}
          onPick={onPick}
          onClose={onClose}
        />,
      );
    });
    if (!renderer) {
      throw new Error("expected renderer");
    }

    for (const key of ["ArrowDown", "ArrowUp", "ArrowRight"]) {
      const event = fakeKeyEvent(key);
      await act(async () => {
        menuDivs(renderer)[0]?.props.onKeyDown(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    }
    expect(onPick).not.toHaveBeenCalled();

    for (const key of ["Enter", " "]) {
      const event = fakeKeyEvent(key);
      await act(async () => {
        menuDivs(renderer)[0]?.props.onKeyDown(event);
      });
      expect(event.preventDefault).toHaveBeenCalled();
      expect(event.stopPropagation).toHaveBeenCalled();
    }
    expect(onPick).toHaveBeenCalledTimes(2);
    expect(onPick).toHaveBeenNthCalledWith(1, "rename");
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      await renderer?.unmount();
    });
  });

  it("keeps nested navigation from driving the ancestor level", async () => {
    const onPick = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <ExplorerMenu
          x={0}
          y={0}
          items={[
            {
              kind: "item",
              id: "copy",
              label: "Copy",
              submenu: [
                { kind: "item", id: "copy-path", label: "Path" },
                { kind: "item", id: "copy-id", label: "Thread ID" },
              ],
            },
            { kind: "item", id: "rename", label: "Rename" },
          ]}
          onPick={onPick}
          onClose={() => {}}
        />,
      );
    });
    if (!renderer) {
      throw new Error("expected renderer");
    }

    // Hover opens the submenu without needing DOM anchor lookup.
    const parentButton = menuButtons(renderer, 0)[0];
    if (!parentButton) {
      throw new Error("expected parent button");
    }
    await act(async () => {
      parentButton.props.onMouseEnter({ currentTarget: {} });
    });
    expect(menuDivs(renderer)).toHaveLength(2);

    const parentActiveBefore = menuDivs(renderer)[0]?.props["aria-activedescendant"];
    const nestedBefore = menuDivs(renderer)[1]?.props["aria-activedescendant"];

    const nestedDown = fakeKeyEvent("ArrowDown");
    await act(async () => {
      menuDivs(renderer)[1]?.props.onKeyDown(nestedDown);
    });

    expect(nestedDown.preventDefault).toHaveBeenCalled();
    expect(nestedDown.stopPropagation).toHaveBeenCalled();
    // Ancestor selection never moves alongside the submenu.
    expect(menuDivs(renderer)[0]?.props["aria-activedescendant"]).toBe(parentActiveBefore);
    expect(menuDivs(renderer)[1]?.props["aria-activedescendant"]).not.toBe(nestedBefore);
    expect(onPick).not.toHaveBeenCalled();

    const nestedEnter = fakeKeyEvent("Enter");
    await act(async () => {
      menuDivs(renderer)[1]?.props.onKeyDown(nestedEnter);
    });
    expect(nestedEnter.stopPropagation).toHaveBeenCalled();
    expect(onPick).toHaveBeenCalledTimes(1);
    // Nested ArrowDown moved from copy-path to copy-id before Enter.
    expect(onPick).toHaveBeenCalledWith("copy-id");

    await act(async () => {
      await renderer?.unmount();
    });
  });

  it("preserves nested ArrowLeft closing only the submenu", async () => {
    const onClose = vi.fn();
    let renderer: ReactTestRenderer | undefined;
    await act(async () => {
      renderer = create(
        <ExplorerMenu
          x={0}
          y={0}
          items={[
            {
              kind: "item",
              id: "copy",
              label: "Copy",
              submenu: [{ kind: "item", id: "copy-path", label: "Path" }],
            },
          ]}
          onPick={() => {}}
          onClose={onClose}
        />,
      );
    });
    if (!renderer) {
      throw new Error("expected renderer");
    }

    const parentButton = menuButtons(renderer, 0)[0];
    if (!parentButton) {
      throw new Error("expected parent button");
    }
    await act(async () => {
      parentButton.props.onMouseEnter({ currentTarget: {} });
    });
    expect(menuDivs(renderer)).toHaveLength(2);

    const left = fakeKeyEvent("ArrowLeft");
    await act(async () => {
      menuDivs(renderer)[1]?.props.onKeyDown(left);
    });

    expect(left.preventDefault).toHaveBeenCalled();
    expect(left.stopPropagation).toHaveBeenCalled();
    // Only the nested level closed; the parent menu stays open.
    expect(menuDivs(renderer)).toHaveLength(1);
    expect(onClose).not.toHaveBeenCalled();

    await act(async () => {
      await renderer?.unmount();
    });
  });

  it("marks file-tree roots without changing the default menu", async () => {
    let plain: ReactTestRenderer | undefined;
    let marked: ReactTestRenderer | undefined;
    await act(async () => {
      plain = create(
        <ExplorerMenu
          x={0}
          y={0}
          items={[{ kind: "item", id: "rename", label: "Rename" }]}
          onPick={() => {}}
          onClose={() => {}}
        />,
      );
    });
    await act(async () => {
      marked = create(
        <ExplorerMenu
          x={0}
          y={0}
          items={[{ kind: "item", id: "rename", label: "Rename" }]}
          onPick={() => {}}
          onClose={() => {}}
          fileTreeMenuRoot
        />,
      );
    });
    expect(menuDivs(plain!)[0]?.props["data-file-tree-context-menu-root"]).toBeUndefined();
    expect(marked && menuDivs(marked)[0]?.props["data-file-tree-context-menu-root"]).toBe("true");

    await act(async () => {
      await plain?.unmount();
      await marked?.unmount();
    });
  });
});
