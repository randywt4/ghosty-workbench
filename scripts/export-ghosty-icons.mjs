// Mechanical size/format exports from the approved raster master; no artwork changes.
import * as NodeFSP from "node:fs/promises";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import sharp from "sharp";
import { encodePngIco, WINDOWS_ICON_SIZES } from "./lib/icon-export.ts";

const repo = NodePath.resolve(NodePath.dirname(NodeURL.fileURLToPath(import.meta.url)), "..");
const assets = NodePath.join(repo, "assets/ghosty");
const publicDir = NodePath.join(repo, "apps/web/public");
const source = NodePath.join(assets, "workbench-master.png");
const metadata = await sharp(source).metadata();
if (!metadata.width || metadata.width !== metadata.height || !metadata.hasAlpha) {
  throw new Error("Expected a square RGBA icon master.");
}
await NodeFSP.mkdir(publicDir, { recursive: true });
const render = (size) => sharp(source).resize(size, size).png().toBuffer();
const master = await render(1024);
await NodeFSP.writeFile(NodePath.join(assets, "workbench-1024.png"), master);
await NodeFSP.writeFile(NodePath.join(publicDir, "ghosty-workbench.png"), master);
for (const size of [16, 32, 180]) {
  await NodeFSP.writeFile(
    NodePath.join(publicDir, `ghosty-workbench-${size}.png`),
    await render(size),
  );
}
const ico = encodePngIco(
  await Promise.all(
    WINDOWS_ICON_SIZES.map(async (size) => ({ size, contents: await render(size) })),
  ),
);
await NodeFSP.writeFile(NodePath.join(assets, "workbench-windows.ico"), ico);
await NodeFSP.writeFile(NodePath.join(publicDir, "ghosty-workbench.ico"), ico);
console.log(`Exported Ghosty Workbench PNGs and ${WINDOWS_ICON_SIZES.length}-size Windows ICO.`);
