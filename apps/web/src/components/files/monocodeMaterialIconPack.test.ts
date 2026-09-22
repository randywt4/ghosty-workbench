import { describe, expect, it } from "@effect/vitest";

import {
  MATERIAL_BLANK_SYMBOL_ID,
  buildMaterialSpriteSheet,
  compoundExtensions,
  materialSymbolId,
  resolveMaterialFileIconName,
  resolveMaterialFolderIconName,
} from "./monocodeMaterialIconPack";

function mockPack() {
  return {
    availableIcons: ["typescript", "folder-src", "file"],
    getFileIcon: ({ fileName }: { fileName?: string; fileExtension?: string }) => {
      if (fileName === "package.json") return "nodejs";
      if (fileName === ".gitignore") return "git";
      return "";
    },
    getFolderIcon: ({
      folderName,
      isOpen,
    }: {
      folderName?: string;
      isOpen?: boolean;
      isRoot?: boolean;
    }) => (folderName === "src" ? (isOpen ? "folder-src-open" : "folder-src") : "folder"),
    getIconSvg: (name: string) => {
      if (name === "typescript")
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><path fill="#007acc" d="M0 0h32v32H0z"/></svg>`;
      if (name === "folder-src")
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#ffca28" d="M0 0h24v24H0z"/></svg>`;
      if (name === "file")
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><path d="M0 0h16v16H0z"/></svg>`;
      return null;
    },
  } as unknown as Parameters<typeof resolveMaterialFileIconName>[0];
}

describe("compoundExtensions", () => {
  it("returns compound suffixes longest-first", () => {
    expect(compoundExtensions("app.d.ts")).toEqual(["d.ts", "ts"]);
    expect(compoundExtensions("archive.spec.ts")).toEqual(["spec.ts", "ts"]);
  });

  it("returns no extensions for dotfiles without suffix", () => {
    expect(compoundExtensions(".gitignore")).toEqual([]);
    expect(compoundExtensions("README")).toEqual([]);
  });

  it("handles normal extensions", () => {
    expect(compoundExtensions("index.rs")).toEqual(["rs"]);
    expect(compoundExtensions("config.toml")).toEqual(["toml"]);
  });
});

describe("resolveMaterialFileIconName", () => {
  it("prefers full filename matches", () => {
    expect(resolveMaterialFileIconName(mockPack(), "package.json")).toBe("nodejs");
    expect(resolveMaterialFileIconName(mockPack(), ".gitignore")).toBe("git");
  });

  it("tries compound suffixes in order before falling back", () => {
    const calls: Array<string | undefined> = [];
    const pack = {
      getFileIcon: ({ fileName, fileExtension }: { fileName?: string; fileExtension?: string }) => {
        calls.push(fileName ?? fileExtension);
        if (fileExtension === "ts") return "typescript";
        return "";
      },
    } as unknown as Parameters<typeof resolveMaterialFileIconName>[0];
    expect(resolveMaterialFileIconName(pack, "App.D.TS")).toBe("typescript");
    // Full name first, then d.ts, then ts.
    expect(calls).toEqual(["app.d.ts", "d.ts", "ts"]);
  });

  it("falls back to file when nothing matches", () => {
    const pack = {
      getFileIcon: () => "",
    } as unknown as Parameters<typeof resolveMaterialFileIconName>[0];
    expect(resolveMaterialFileIconName(pack, "mystery.xyz")).toBe("file");
  });
});

describe("resolveMaterialFolderIconName", () => {
  it("passes folder name and open state through", () => {
    const pack = mockPack();
    expect(resolveMaterialFolderIconName(pack, "src", false)).toBe("folder-src");
    expect(resolveMaterialFolderIconName(pack, "src", true)).toBe("folder-src-open");
    expect(resolveMaterialFolderIconName(pack, "docs", false)).toBe("folder");
  });
});

describe("buildMaterialSpriteSheet", () => {
  it("prefixes symbols, preserves viewBoxes, and includes a blank", () => {
    const sheet = buildMaterialSpriteSheet(mockPack());
    expect(sheet).toContain(`id="${MATERIAL_BLANK_SYMBOL_ID}"`);
    expect(sheet).toContain(`id="${materialSymbolId("typescript")}"`);
    expect(sheet).toContain('viewBox="0 0 32 32"');
    expect(sheet).toContain(`id="${materialSymbolId("folder-src")}"`);
    expect(sheet).toContain('viewBox="0 0 24 24"');
    // Known source colors are preserved, not fabricated.
    expect(sheet).toContain("#007acc");
    expect(sheet).toContain("#ffca28");
    expect(sheet.startsWith("<svg")).toBe(true);
  });
});
