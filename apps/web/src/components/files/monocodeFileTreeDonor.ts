import type {
  FileTreeIconConfig,
  FileTreeIcons,
  FileTreeRowDecoration,
  FileTreeRowDecorationContext,
  RemappedIcon,
} from "@pierre/trees";

import { T3_PIERRE_ICONS } from "~/pierre-icons";

import {
  MATERIAL_BLANK_SPRITESHEET,
  MATERIAL_BLANK_SYMBOL_ID,
  buildMaterialSpriteSheet,
  getMaterialPackSnapshot,
  materialSymbolId,
  materialSymbolViewBox,
  resolveMaterialFileIconName,
  resolveMaterialFolderIconName,
} from "./monocodeMaterialIconPack";

/** Donor row metrics from pinned `FileTree.tsx` + reference screenshot. */
export const MONOCODE_FILE_ROW_HEIGHT = 30;
export const MONOCODE_FILE_FONT_SIZE = 14;
export const MONOCODE_FILE_INDENT_BASE = 8;
export const MONOCODE_FILE_INDENT_STEP = 12;
export const MONOCODE_FILE_CHEVRON_SIZE = 14;
export const MONOCODE_FILE_ICON_SIZE = 16;
export const MONOCODE_FILE_ROW_GAP = 4;
export const MONOCODE_FILE_ROOT_HEIGHT = 32;
export const MONOCODE_FILE_ROOT_FONT_SIZE = 11;

/**
 * Donor git label colors from pinned `FileTree.tsx` `GIT_STATUS_COLOR`:
 * modified amber-400, added/untracked emerald-400, deleted red-400.
 * Pierre renders git status via `--trees-status-*` tokens (label + icon +
 * git lane) plus a descendant dot for folders, so override the tokens
 * instead of inventing new hues.
 */
const GIT_MODIFIED = "#fbbf24";
const GIT_ADDED = "#34d399";
const GIT_UNTRACKED = "#34d399";
const GIT_DELETED = "#f87171";

/**
 * Shadow-DOM overrides that make the Pierre tree read as the donor Explorer:
 * 30px rows, 14px labels, 8px + depth*12px indent, 14px chevron + 16px
 * material glyph with 4px gap, square rows, content-mix 10% selection and
 * 5% hover, donor git hues. The material glyph itself is supplied via
 * `renderMonocodeRowDecoration` (decoration lane) and reordered between the
 * chevron (icon lane) and the label (content lane); the built-in file icon
 * lane is hidden for files so the material glyph is the single file glyph.
 */
export const MONOCODE_FILE_TREE_UNSAFE_CSS = `
  :host {
    --trees-font-size-override: ${MONOCODE_FILE_FONT_SIZE}px;
    --trees-level-gap-override: ${MONOCODE_FILE_INDENT_STEP}px;
    --trees-item-padding-x-override: ${MONOCODE_FILE_INDENT_BASE}px;
    --trees-item-row-gap-override: ${MONOCODE_FILE_ROW_GAP}px;
    --trees-border-radius-override: 0;
    --trees-icon-width-override: ${MONOCODE_FILE_ICON_SIZE}px;
    --trees-selected-bg-override: color-mix(in srgb, currentColor 10%, transparent);
    --trees-bg-muted-override: color-mix(in srgb, currentColor 5%, transparent);
    --trees-status-modified-override: ${GIT_MODIFIED};
    --trees-status-added-override: ${GIT_ADDED};
    --trees-status-untracked-override: ${GIT_UNTRACKED};
    --trees-status-deleted-override: ${GIT_DELETED};
  }
  button[data-type='item'] { border-radius: 0; }
  [data-item-section='icon'] { order: 1; }
  [data-item-section='decoration'] {
    order: 2;
    flex: 0 0 auto;
    width: ${MONOCODE_FILE_ICON_SIZE}px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  [data-item-section='decoration'] > span {
    width: ${MONOCODE_FILE_ICON_SIZE}px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }
  [data-item-section='content'] { order: 3; }
  [data-item-section='git'] { order: 4; }
  [data-item-section='action'] { order: 5; }
  /* The donor reserves the chevron lane for files too, keeping all glyphs aligned. */
  [data-item-type='file'] > [data-item-section='icon'] { visibility: hidden; }
  [data-icon-name='file-tree-icon-chevron'] { width: ${MONOCODE_FILE_CHEVRON_SIZE}px; height: ${MONOCODE_FILE_CHEVRON_SIZE}px; }
  [data-item-section='decoration'] svg { width: ${MONOCODE_FILE_ICON_SIZE}px; height: ${MONOCODE_FILE_ICON_SIZE}px; display: block; }
`;

function basenameOfTreePath(treePath: string): string {
  const trimmed = treePath.endsWith("/") ? treePath.slice(0, -1) : treePath;
  const slash = trimmed.lastIndexOf("/");
  return slash === -1 ? trimmed : trimmed.slice(slash + 1);
}

/**
 * Donor glyph for a Pierre visible row. Folders use `getFolderIcon` with the
 * row's expanded state (donor `isOpen`); files use the donor's filename +
 * compound-extension resolution. Returns a blank placeholder until the
 * material pack loads so rows do not reflow when glyphs arrive. Flattened
 * directory rows keep the terminal segment's folder glyph.
 */
export function renderMonocodeRowDecoration(
  context: FileTreeRowDecorationContext,
): FileTreeRowDecoration | null {
  const pack = getMaterialPackSnapshot();
  const row = context.row;
  const isDirectory = row.kind === "directory";
  if (!pack) {
    // Hold a same-sized blank so labels do not shift when the pack lands.
    // Files hide the built-in icon lane, so they need the placeholder too.
    return {
      icon: { name: MATERIAL_BLANK_SYMBOL_ID, width: 16, height: 16, viewBox: "0 0 16 16" },
    };
  }
  const targetPath = row.isFlattened
    ? (row.flattenedSegments?.findLast((segment) => segment.isTerminal)?.path ?? row.path)
    : row.path;
  const baseName = basenameOfTreePath(targetPath);
  const iconName = isDirectory
    ? resolveMaterialFolderIconName(pack, baseName.toLowerCase(), row.isExpanded, false)
    : resolveMaterialFileIconName(pack, baseName);
  const symbolId = materialSymbolId(iconName);
  return {
    icon: {
      name: symbolId,
      width: 16,
      height: 16,
      viewBox: materialSymbolViewBox(symbolId),
    },
  };
}

function innerOfSpriteSheet(sheet: string): string {
  const match = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(sheet.trim());
  return match?.[1]?.trim() ?? "";
}

/**
 * Merge several single-`<svg>` spriteSheets into one. Pierre parses the
 * custom sheet via `querySelector("svg")`, so concatenating two `<svg>`
 * documents would drop everything after the first; combine the inner
 * `<symbol>` lists instead.
 */
export function mergeSpriteSheets(...sheets: string[]): string {
  const inner = sheets.map(innerOfSpriteSheet).filter(Boolean).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">${inner}</svg>`;
}

/**
 * Icons config for `useFileTree` + `model.setIcons`. Keeps Pierre's built-in
 * `complete` set (chevron/dot/lock) and T3's custom filename/extension rules
 * (video/agents/pnpm), remaps the chevron to the donor's 14px, and injects
 * the material spriteSheet (blank until the pack loads, full after).
 */
export function buildMonocodeFileTreeIcons(): FileTreeIcons {
  const pack = getMaterialPackSnapshot();
  const materialSheet = pack ? buildMaterialSpriteSheet(pack) : MATERIAL_BLANK_SPRITESHEET;
  const t3Sheet = (T3_PIERRE_ICONS as { spriteSheet?: string }).spriteSheet ?? "";
  const chevronRemap: RemappedIcon = {
    name: "file-tree-icon-chevron",
    width: MONOCODE_FILE_CHEVRON_SIZE,
    height: MONOCODE_FILE_CHEVRON_SIZE,
    viewBox: "0 0 16 16",
  };
  const t3Config = T3_PIERRE_ICONS as FileTreeIconConfig;
  return {
    ...t3Config,
    remap: { "file-tree-icon-chevron": chevronRemap },
    spriteSheet: mergeSpriteSheets(t3Sheet, materialSheet),
  };
}
