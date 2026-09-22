# Ghosty Workbench development

This is Randy's personal T3 fork. The source may remain public; app data,
credentials and conversations stay out of Git. Product decisions and the current
checkpoint live in the sibling GhostyOperations repository at
`plans/tooling/ghosty-workbench-current.md`.

## Windows desktop loop

Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ghosty-desktop.ps1`.
The desktop and Start-menu shortcuts invoke the same launcher. This starts the
upstream `dev:desktop` task: a local Vite renderer inside Electron plus its local
backend. React/CSS edits hot-reload; desktop/server edits can rebuild or restart.
The first launch builds the native shell. No public website or Docker is involved.

`-Action Status` inspects the captured runner identity. `-Action Stop` stops only
that verified process tree, including agents running in this development app;
finish their work before stopping. After a reboot, use Start again. Closing the
window does not necessarily stop watchers; use Stop then Start to reopen it.

State, logs and ownership receipt: `%LOCALAPPDATA%/GhostyWorkbenchDev`.
The server home is `state/`; Chromium profile is `electron-profile/`.
Ports are 19833 (renderer), 27873 (backend) and 19834 (local Electron inspection).
Never run another server on this state. Leave normal T3/Paseo/Synara data alone.
The debug endpoint is for development only; do not expose these ports publicly.
Electron handles its built-in local connection; browser pairing is a separate flow.

Prerequisites: private Node 24.13.1 at
`%LOCALAPPDATA%/GhostyWorkbenchTools/node-v24.13.1-win-x64/node.exe`, pnpm 11.10.0.
Put that Node first on process PATH, then run the locked scoped install:

```powershell
pnpm install --frozen-lockfile --filter @t3tools/desktop... --filter @t3tools/web... --filter t3... --filter @t3tools/monorepo
```

Do not replace global Node, reinstall on every launch, reset the data, or run
repo-wide tests just to preview CSS. Capture actual screenshots for Randy's review.

## Upstream and private customization

- `origin` is `randywt4/ghosty-workbench`; `upstream` is `pingdotgg/t3code`.
- Local `main` currently carries our custom code and publishes explicitly to
  `origin/ghosty-ui`. `origin/main` is a different baseline: never plain-pull it.
- Base: experimental V2 commit `2341c5a680042a5a5aae5997656120b7dfd8961b`.
  Do not assume it has merged into the stable upstream line.
- Fetching upstream is read-only for the checkout. Inspect ancestry, release
  notes, dependencies and our diff before proposing an update. Prefer a compatible
  released baseline once V2 lands; use a focused cherry-pick for an urgent isolated
  fix only after checking prerequisites. Do not blindly merge every new PR.
- Save the current source and a consistent SQLite backup before an approved
  update that can migrate state. Test the candidate against an isolated data copy.
  Git rollback alone cannot undo a database migration.
- Keep donor visuals in `apps/web/src/components/monocode` where practical.
  Retain MIT/license notices and provenance. Copying another app's component
  still requires adapting its behavior and dependencies to T3.
- Keep small, focused commits. Do not mass-rename T3 package IDs or internal
  protocol names to accomplish cosmetic branding. Avoid unnecessary upstream edits.

## Packaging later

Development mode is for live edits; a separately packaged app is the daily-use
snapshot. Branding must cover icons, visible titles, installer identity, app data,
protocol registration, taskbar ID and update source together. Disable upstream
auto-updates in the personal app until an explicit compatible update route exists.
Build Windows artifacts with the existing desktop artifact scripts after branding
is approved. Keep installers and generated output outside Git. Verify side-by-side
installation, relaunch and history before replacing daily use. No release now.
