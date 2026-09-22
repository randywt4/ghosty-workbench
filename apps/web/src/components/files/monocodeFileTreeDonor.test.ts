import { describe, expect, it } from "@effect/vitest";

import {
  MONOCODE_FILE_CHEVRON_SIZE,
  MONOCODE_FILE_ICON_SIZE,
  MONOCODE_FILE_TREE_UNSAFE_CSS,
  buildMonocodeFileTreeIcons,
  mergeSpriteSheets,
  renderMonocodeRowDecoration,
} from "./monocodeFileTreeDonor";
import { MATERIAL_BLANK_SYMBOL_ID } from "./monocodeMaterialIconPack";

function rowContext(kind: "directory" | "file", name: string, isExpanded = false) {
  return {
    item: { kind, name, path: name },
    row: {
      kind,
      name,
      path: name,
      ancestorPaths: [],
      depth: 0,
      hasChildren: kind === "directory",
      index: 0,
      isExpanded,
      isFlattened: false,
      isFocused: false,
      isSelected: false,
      level: 0,
      posInSet: 0,
      setSize: 1,
    },
  } as unknown as Parameters<typeof renderMonocodeRowDecoration>[0];
}

describe("mergeSpriteSheets", () => {
  it("combines symbol lists into a single svg", () => {
    const merged = mergeSpriteSheets(
      `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="a" viewBox="0 0 16 16"></symbol></svg>`,
      `<svg xmlns="http://www.w3.org/2000/svg"><symbol id="b" viewBox="0 0 16 16"></symbol></svg>`,
    );
    expect(merged.startsWith("<svg")).toBe(true);
    expect(merged).toContain('id="a"');
    expect(merged).toContain('id="b"');
    expect(merged.match(/<svg/g)?.length).toBe(1);
  });
});

describe("MONOCODE_FILE_TREE_UNSAFE_CSS", () => {
  it("encodes donor row metrics, states, and git hues", () => {
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("--trees-font-size-override: 14px");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("--trees-level-gap-override: 12px");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("--trees-item-padding-x-override: 8px");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("--trees-item-row-gap-override: 4px");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("--trees-border-radius-override: 0");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("currentColor 10%");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("currentColor 5%");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("#fbbf24");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("#34d399");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("#f87171");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("[data-item-type='file']");
    expect(MONOCODE_FILE_TREE_UNSAFE_CSS).toContain("[data-item-section='decoration']");
  });
});

describe("renderMonocodeRowDecoration", () => {
  it("holds a same-sized blank until the pack loads to avoid reflow", () => {
    for (const context of [rowContext("file", "app.ts"), rowContext("directory", "src", true)]) {
      const decoration = renderMonocodeRowDecoration(context);
      expect(decoration).toEqual({
        icon: { name: MATERIAL_BLANK_SYMBOL_ID, width: 16, height: 16, viewBox: "0 0 16 16" },
      });
    }
  });
});

describe("buildMonocodeFileTreeIcons", () => {
  it("remaps the chevron to 14px and keeps T3 custom rules with a blank sheet", () => {
    const icons = buildMonocodeFileTreeIcons() as {
      remap?: Record<string, { width?: number; height?: number }>;
      spriteSheet?: string;
      byFileName?: Record<string, string>;
      set?: string;
    };
    expect(icons.remap?.["file-tree-icon-chevron"]).toMatchObject({
      width: MONOCODE_FILE_CHEVRON_SIZE,
      height: MONOCODE_FILE_CHEVRON_SIZE,
    });
    expect(MONOCODE_FILE_ICON_SIZE).toBe(16);
    // T3 custom filename rules (agents/video/pnpm) survive the donor wrapper.
    expect(icons.byFileName?.["agents.md"]).toBeDefined();
    expect(icons.set).toBe("complete");
    expect(icons.spriteSheet).toContain(MATERIAL_BLANK_SYMBOL_ID);
    expect(icons.spriteSheet).toContain("t3-file-icon-video");
  });
});
