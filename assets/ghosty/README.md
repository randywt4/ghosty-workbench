# Ghosty Workbench icon

Randy selected original concept 03 (ghost dog behind a laptop) on 2026-09-22.
`workbench-master.png` is the standalone version generated with the built-in
image tool from that approved board, inspired by Ghosty Media's existing mascot.
It is a Ghosty asset, not an upstream T3 or MonoCode logo.

Run `node scripts/export-ghosty-icons.mjs` using the repository's Node version
to regenerate the PNG sizes and multi-resolution Windows ICO. This only changes
dimensions/format; edit the master intentionally for future design changes.
The script also writes the corresponding `apps/web/public/ghosty-workbench*` assets.

The source comparison board and generation provenance are retained in Randy's
GhostyOperations repository under `brand/ghosty-workbench/concepts`.
