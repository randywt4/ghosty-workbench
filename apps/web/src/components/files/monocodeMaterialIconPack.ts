/**
 * MonoCode donor material icon pack adapter for the right Files tree.
 *
 * Pinned donor: https://github.com/hardbeat920/monocode/tree/bb3924b61f4d48ba12327ee1eb70a8b83d95e51d
 * Donor source: `src/features/files/ui/FileTypeIcon.tsx` (filename + compound
 * extension resolution, lazy `react-material-icon-theme` pack loading with a
 * same-sized blank placeholder to avoid reflow).
 *
 * This module reuses that exact resolution (full filename, then compound
 * suffixes such as `d.ts` then `ts`) and lazy loading, but exposes the pack
 * for the Pierre `@pierre/trees` shadow-DOM renderer via `spriteSheet` +
 * `setIcons` instead of React components. The Tauri filesystem/git runtime
 * from the donor is not imported. Colors come from the material SVGs' inline
 * fills (known source assets); no file-type colors are fabricated here.
 */

type MaterialIconPack = typeof import("react-material-icon-theme");

let pack: MaterialIconPack | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function loadPack(): void {
  if (pack || loading) return;
  loading = import("react-material-icon-theme")
    .then((mod) => {
      pack = mod;
      for (const listener of listeners) listener();
    })
    .catch(() => {
      // A transient chunk failure must not prevent a later panel mount retrying.
      loading = null;
    });
}

export function subscribeMaterialPack(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  loadPack();
  return () => {
    listeners.delete(onStoreChange);
  };
}

export function getMaterialPackSnapshot(): MaterialIconPack | null {
  return pack;
}

/**
 * Donor-verbatim compound extension list: full suffixes first
 * (`d.ts`, then `ts`) so `.rs` / `.toml` / `.json` resolve by compound suffix.
 * Lowercase input before calling (donor lowercases the filename once).
 */
export function compoundExtensions(fileName: string): string[] {
  const parts = fileName.split(".");
  const start = parts[0] === "" ? 1 : 0;
  const exts: string[] = [];
  for (let i = start + 1; i < parts.length; i++) {
    exts.push(parts.slice(i).join("."));
  }
  return exts;
}

/**
 * Donor-verbatim file resolution: the package only checks `fileExtension`
 * when that prop is set — it does not peel an extension off `fileName`.
 * Try the full name, then compound suffixes. Returns the material icon name
 * (e.g. `typescript`, `folder-src-open`) or `"file"` fallback.
 */
export function resolveMaterialFileIconName(icons: MaterialIconPack, fileName: string): string {
  const key = fileName.toLowerCase();
  const fromName = icons.getFileIcon({
    fileName: key,
    fallback: "",
    iconPack: "",
  });
  if (fromName) return fromName;

  for (const ext of compoundExtensions(key)) {
    const fromExt = icons.getFileIcon({
      fileExtension: ext,
      fallback: "",
      iconPack: "",
    });
    if (fromExt) return fromExt;
  }

  return "file";
}

export function resolveMaterialFolderIconName(
  icons: MaterialIconPack,
  folderName: string,
  isOpen: boolean,
  isRoot = false,
): string {
  return icons.getFolderIcon({ folderName, isOpen, isRoot });
}

export function getMaterialIconSvg(icons: MaterialIconPack, iconName: string): string {
  return icons.getIconSvg(iconName) ?? "";
}

const MATERIAL_SYMBOL_PREFIX = "material-";
export const MATERIAL_BLANK_SYMBOL_ID = `${MATERIAL_SYMBOL_PREFIX}blank`;

export const MATERIAL_BLANK_SPRITESHEET = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true"><symbol id="${MATERIAL_BLANK_SYMBOL_ID}" viewBox="0 0 16 16"></symbol></svg>`;

interface BuiltSymbol {
  id: string;
  viewBox: string;
  inner: string;
}

function svgToSymbol(iconName: string, svg: string): BuiltSymbol | null {
  const viewBoxMatch = /viewBox="([^"]+)"/.exec(svg);
  const innerMatch = /<svg[^>]*>([\s\S]*)<\/svg>/.exec(svg);
  const inner = innerMatch?.[1]?.trim() ?? "";
  if (!inner) return null;
  return {
    id: `${MATERIAL_SYMBOL_PREFIX}${iconName}`,
    viewBox: viewBoxMatch?.[1] ?? "0 0 32 32",
    inner,
  };
}

let cachedSpriteSheet: { pack: MaterialIconPack; sheet: string } | null = null;
const cachedViewBoxes = new Map<string, string>();

/**
 * Build a shadow-DOM `<symbol>` spriteSheet from the material pack's known
 * source assets. Symbol IDs are prefixed to avoid colliding with Pierre's
 * built-in `file-tree-*` IDs. ViewBoxes are preserved per icon so 24px and
 * 32px glyphs scale correctly into 16px rows. Result is cached per pack.
 */
export function buildMaterialSpriteSheet(icons: MaterialIconPack): string {
  if (cachedSpriteSheet?.pack === icons) return cachedSpriteSheet.sheet;
  const symbols: string[] = [
    `<symbol id="${MATERIAL_BLANK_SYMBOL_ID}" viewBox="0 0 16 16"></symbol>`,
  ];
  cachedViewBoxes.set(MATERIAL_BLANK_SYMBOL_ID, "0 0 16 16");
  const names: readonly string[] = icons.availableIcons ?? [];
  for (const name of names) {
    const svg = icons.getIconSvg(name);
    if (!svg) continue;
    const symbol = svgToSymbol(name, svg);
    if (!symbol) continue;
    symbols.push(`<symbol id="${symbol.id}" viewBox="${symbol.viewBox}">${symbol.inner}</symbol>`);
    cachedViewBoxes.set(symbol.id, symbol.viewBox);
  }
  const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true">${symbols.join("")}</svg>`;
  cachedSpriteSheet = { pack: icons, sheet };
  return sheet;
}

export function materialSymbolId(iconName: string): string {
  return `${MATERIAL_SYMBOL_PREFIX}${iconName}`;
}

export function materialSymbolViewBox(symbolId: string): string {
  return cachedViewBoxes.get(symbolId) ?? "0 0 32 32";
}
