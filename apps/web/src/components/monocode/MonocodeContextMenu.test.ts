import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  dismissMonocodeContextMenu,
  isMonocodeContextMenuOpen,
  resetMonocodeContextMenuForTests,
  showMonocodeContextMenu,
  toExplorerMenuItems,
} from "./MonocodeContextMenu";

const bridgeRootMocks = vi.hoisted(() => ({
  render: vi.fn(),
  unmount: vi.fn(),
  createRoot: vi.fn(),
}));

vi.mock("react-dom/client", () => ({
  createRoot: (...args: Array<unknown>) =>
    (bridgeRootMocks.createRoot as (...a: Array<unknown>) => unknown)(...args),
}));

class FakeMenuHTMLElement {
  attrs: Record<string, string> = {};
  shadowRoot?: { activeElement: FakeMenuHTMLElement };
  focusCalledWith: unknown = undefined;
  isConnected = true;

  setAttribute(key: string, value: string) {
    this.attrs[key] = value;
  }

  remove() {}

  focus(options?: unknown) {
    this.focusCalledWith = options;
  }

  closest(_selector: string): unknown {
    return null;
  }
}

type MutableDoc = {
  activeElement: unknown;
  body: unknown;
  createElement: (...args: Array<unknown>) => unknown;
};

function stubMenuDocument(activeElement: unknown) {
  const body = new FakeMenuHTMLElement();
  (body as unknown as Record<string, unknown>).appendChild = () => {};
  const doc = {
    activeElement,
    body,
    createElement: () => new FakeMenuHTMLElement(),
  };
  vi.stubGlobal("HTMLElement", FakeMenuHTMLElement);
  vi.stubGlobal("document", doc);
  return doc as unknown as MutableDoc & {
    body: FakeMenuHTMLElement;
  };
}

function lastRenderedHostProps(): {
  onPick: (id: string) => void;
  onClose: () => void;
} {
  const calls = bridgeRootMocks.render.mock.calls;
  if (calls.length === 0) {
    throw new Error("expected Host to render");
  }
  const element = calls[calls.length - 1]?.[0] as {
    props?: { onPick?: (id: string) => void; onClose?: () => void };
  };
  if (!element?.props?.onPick || !element?.props?.onClose) {
    throw new Error("expected Host onPick/onClose props");
  }
  return { onPick: element.props.onPick, onClose: element.props.onClose };
}

beforeEach(() => {
  bridgeRootMocks.render.mockClear();
  bridgeRootMocks.unmount.mockClear();
  bridgeRootMocks.createRoot.mockClear();
});

afterEach(() => {
  try {
    resetMonocodeContextMenuForTests();
  } catch {
    // No menu open or document already unstubbed.
  }
  vi.unstubAllGlobals();
});

describe("toExplorerMenuItems", () => {
  it("preserves flat IDs, labels and disabled", () => {
    const converted = toExplorerMenuItems([
      { id: "rename", label: "Rename thread" },
      { id: "mark-unread", label: "Mark unread", disabled: true },
    ]);

    expect(converted).toHaveLength(2);
    expect(converted[0]).toMatchObject({ kind: "item", id: "rename", label: "Rename thread" });
    expect(converted[1]).toMatchObject({
      kind: "item",
      id: "mark-unread",
      disabled: true,
    });
  });

  it("marks leaf destructive and bare delete IDs as danger", () => {
    const converted = toExplorerMenuItems([
      { id: "archive", label: "Archive thread" },
      { id: "delete", label: "Delete" },
      { id: "remove", label: "Remove", destructive: true },
    ]);

    expect(converted[0]).toMatchObject({ id: "archive", danger: undefined });
    expect(converted[1]).toMatchObject({ id: "delete", danger: true });
    expect(converted[2]).toMatchObject({ id: "remove", danger: true });
  });

  it("inserts one separator for separatorBefore, never leading", () => {
    const converted = toExplorerMenuItems([
      { id: "rename", label: "Rename" },
      { id: "archive", label: "Archive", separatorBefore: true },
      { id: "delete", label: "Delete", separatorBefore: true },
    ]);

    expect(converted.map((entry) => entry.kind)).toEqual(["item", "sep", "item", "sep", "item"]);
  });

  it("does not lead with a separator", () => {
    const converted = toExplorerMenuItems([
      { id: "rename", label: "Rename", separatorBefore: true },
    ]);

    expect(converted).toHaveLength(1);
    expect(converted[0]).toMatchObject({ kind: "item", id: "rename" });
  });

  it("converts headers to non-pickable section labels", () => {
    const converted = toExplorerMenuItems([
      { id: "section", label: "Threads", header: true },
      { id: "rename", label: "Rename" },
    ]);

    expect(converted[0]).toMatchObject({ kind: "header", label: "Threads" });
    expect(converted[1]).toMatchObject({ kind: "item", id: "rename" });
  });

  it("preserves submenu child IDs one level deep", () => {
    const converted = toExplorerMenuItems([
      {
        id: "copy",
        label: "Copy",
        children: [
          { id: "copy-path", label: "Path" },
          { id: "copy-thread-id", label: "Thread ID" },
        ],
      },
    ]);

    const parent = converted[0];
    expect(parent).toMatchObject({ kind: "item", id: "copy", label: "Copy" });
    if (parent?.kind !== "item") {
      throw new Error("expected parent item");
    }
    expect(parent.submenu?.map((child) => child.kind)).toEqual(["item", "item"]);
    if (parent.submenu?.[0]?.kind !== "item" || parent.submenu?.[1]?.kind !== "item") {
      throw new Error("expected child items");
    }
    expect(parent.submenu[0]).toMatchObject({ id: "copy-path" });
    expect(parent.submenu[1]).toMatchObject({ id: "copy-thread-id" });
  });

  it("supports actual contract depth without losing nested levels", () => {
    const converted = toExplorerMenuItems([
      {
        id: "level-1",
        label: "Level 1",
        children: [
          {
            id: "level-2",
            label: "Level 2",
            children: [{ id: "level-3-leaf", label: "Leaf" }],
          },
        ],
      },
    ]);

    const level1 = converted[0];
    if (level1?.kind !== "item") {
      throw new Error("expected level 1 item");
    }
    const level2 = level1.submenu?.[0];
    if (level2?.kind !== "item") {
      throw new Error("expected level 2 item, nested level was lost");
    }
    expect(level2).toMatchObject({ id: "level-2" });
    const leaf = level2.submenu?.[0];
    if (leaf?.kind !== "item") {
      throw new Error("expected level 3 leaf, nested level was lost");
    }
    expect(leaf).toMatchObject({ id: "level-3-leaf", label: "Leaf" });
  });

  it("maps known icon keywords and omits unknown ones", () => {
    const converted = toExplorerMenuItems([
      { id: "rename", label: "Rename", icon: "pencil" },
      { id: "delete", label: "Delete", icon: "trash" },
      { id: "copy-id", label: "Thread ID", icon: "hash" },
      { id: "unread", label: "Mark unread", icon: "mail-open" },
    ]);

    if (
      converted[0]?.kind !== "item" ||
      converted[1]?.kind !== "item" ||
      converted[2]?.kind !== "item" ||
      converted[3]?.kind !== "item"
    ) {
      throw new Error("expected items");
    }
    expect(converted[0].icon).toBeDefined();
    expect(converted[1].icon).toBeDefined();
    // No MonoCode chrome equivalent; labels and IDs still preserved.
    expect(converted[2].icon).toBeUndefined();
    expect(converted[3].icon).toBeUndefined();
    expect(converted[2]).toMatchObject({ id: "copy-id", label: "Thread ID" });
  });
});

describe("showMonocodeContextMenu lifecycle", () => {
  it("resolves the picked original ID", async () => {
    const outside = new FakeMenuHTMLElement();
    const doc = stubMenuDocument(outside);
    bridgeRootMocks.createRoot.mockImplementation(() => ({
      render: bridgeRootMocks.render,
      unmount: bridgeRootMocks.unmount,
    }));

    const promise = showMonocodeContextMenu([{ id: "rename", label: "Rename" }], { x: 4, y: 5 });
    expect(isMonocodeContextMenuOpen()).toBe(true);
    expect(doc.activeElement).toBe(outside);

    lastRenderedHostProps().onPick("rename");

    await expect(promise).resolves.toBe("rename");
    expect(isMonocodeContextMenuOpen()).toBe(false);
  });

  it("dismiss resolves null like outside click or Escape", async () => {
    stubMenuDocument(new FakeMenuHTMLElement());
    bridgeRootMocks.createRoot.mockImplementation(() => ({
      render: bridgeRootMocks.render,
      unmount: bridgeRootMocks.unmount,
    }));

    const promise = showMonocodeContextMenu([{ id: "rename", label: "Rename" }]);
    expect(isMonocodeContextMenuOpen()).toBe(true);

    dismissMonocodeContextMenu();

    await expect(promise).resolves.toBeNull();
    expect(isMonocodeContextMenuOpen()).toBe(false);
  });

  it("a new show supersedes the open menu with null", async () => {
    stubMenuDocument(new FakeMenuHTMLElement());
    bridgeRootMocks.createRoot.mockImplementation(() => ({
      render: bridgeRootMocks.render,
      unmount: bridgeRootMocks.unmount,
    }));

    const first = showMonocodeContextMenu([{ id: "first", label: "First" }]);
    const second = showMonocodeContextMenu([{ id: "second", label: "Second" }]);

    await expect(first).resolves.toBeNull();
    expect(isMonocodeContextMenuOpen()).toBe(true);

    lastRenderedHostProps().onPick("second");
    await expect(second).resolves.toBe("second");
    expect(isMonocodeContextMenuOpen()).toBe(false);
  });

  it("restores the trigger when focus was inside the menu at close", async () => {
    const trigger = new FakeMenuHTMLElement();
    const doc = stubMenuDocument(trigger);
    const menuEl = new FakeMenuHTMLElement();
    menuEl.closest = () => ({});
    const bodyEl = doc.body as FakeMenuHTMLElement;
    bodyEl.closest = () => null;
    bridgeRootMocks.createRoot.mockImplementation(() => ({
      render: bridgeRootMocks.render,
      // Real DOM resets activeElement to body once the portal unmounts.
      unmount: () => {
        doc.activeElement = bodyEl;
      },
    }));

    const promise = showMonocodeContextMenu([{ id: "rename", label: "Rename" }]);
    // Focus moved into the portaled menu while open (Popover autoFocus).
    doc.activeElement = menuEl;

    lastRenderedHostProps().onClose();

    await expect(promise).resolves.toBeNull();
    expect(trigger.focusCalledWith).toEqual({ preventScroll: true });
  });

  it("restores the actual keyboard target inside a shadow tree", async () => {
    const treeHost = new FakeMenuHTMLElement();
    const treeRow = new FakeMenuHTMLElement();
    treeHost.shadowRoot = { activeElement: treeRow };
    const doc = stubMenuDocument(treeHost);
    const menuEl = new FakeMenuHTMLElement();
    menuEl.closest = () => ({});
    bridgeRootMocks.createRoot.mockImplementation(() => ({
      render: bridgeRootMocks.render,
      unmount: () => {
        doc.activeElement = doc.body;
      },
    }));
    const promise = showMonocodeContextMenu([{ id: "open", label: "Open" }]);
    doc.activeElement = menuEl;
    lastRenderedHostProps().onClose();
    await expect(promise).resolves.toBeNull();
    expect(treeRow.focusCalledWith).toEqual({ preventScroll: true });
    expect(treeHost.focusCalledWith).toBeUndefined();
  });

  it("does not steal focus when focus already left the menu", async () => {
    const trigger = new FakeMenuHTMLElement();
    const doc = stubMenuDocument(trigger);
    const outside = new FakeMenuHTMLElement();
    outside.closest = () => null;
    const bodyEl = doc.body as FakeMenuHTMLElement;
    bodyEl.closest = () => null;
    bridgeRootMocks.createRoot.mockImplementation(() => ({
      render: bridgeRootMocks.render,
      unmount: () => {
        doc.activeElement = bodyEl;
      },
    }));

    const promise = showMonocodeContextMenu([{ id: "rename", label: "Rename" }]);
    // An outside pointer already moved focus out before dismissal.
    doc.activeElement = outside;

    lastRenderedHostProps().onClose();

    await expect(promise).resolves.toBeNull();
    expect(trigger.focusCalledWith).toBeUndefined();
  });
});
