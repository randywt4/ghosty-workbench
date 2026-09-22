# MonoCode UI reuse

Source: https://github.com/hardbeat920/monocode/tree/bb3924b61f4d48ba12327ee1eb70a8b83d95e51d

The adjacent LICENSE and NOTICE apply to the imported material.

- `providers/*.svg`: unchanged `src/assets/providers/*.svg`.
- `HarnessIcon.tsx`: `src/features/sessions/ui/HarnessIcon.tsx`; adapted import paths and standalone harness type.
- `icons.tsx`: unchanged `src/shared/ui/icons.tsx`.
- `ComposerBox.tsx`: extracted visual box from `src/features/sessions/ui/Composer.tsx`; scoped donor tokens. T3 owns editor state and execution.
- `SessionRow.tsx`: adapted model-header for the legacy sidebar three-line card layout from `src/app/shell/Sidebar.tsx`. T3 owns navigation and lifecycle.
- `monocode.css`: composer height, toolbar and primary action from the same pinned source; mobile touch targets retain T3's accessibility behavior.

This imports the requested visual portions, not MonoCode's Tauri runtime or session store.

`ComposerControl.tsx` adapts the donor ModelPicker and AccessPicker trigger classes; `ComposerPrimaryActions.tsx` adapts ComposerAction sizing and icons. LegacySidebar adapts the donor model/title/checkout ordering. T3 retains provider controls and lifecycle actions behind the donor visual interfaces. The activity sidebar is unchanged; new profiles default to legacy mode.

The shared donor port now includes:

- `Popover.tsx`, `popoverPlacement.ts`, `layers.ts`: `src/shared/ui/Popover.tsx` and
  `src/shared/lib/{popover,layers}.ts`; local imports, explicit optional types for
  T3 TypeScript, and a scoped portal theme class.
- `GlassBackdrop.tsx`: `src/app/shell/GlassBackdrop.tsx`.
- `ExplorerMenu.tsx`: `src/features/files/ui/ExplorerMenu.tsx`.
- `ColorPickerPopover.tsx`, `colorUtils.ts`: original shared color controls/math.
- `TabGroupMenu.tsx`, `tabGroupColors.ts`: workspace TabGroupMenu and palette;
  project-logo upload removed as requested. `ProjectMenu.tsx` is the T3 adapter.
- `ProjectMascot.tsx`, `projectMascots.ts`: original project mascot renderer/art.
- `SessionCard.tsx`, `SessionRow.tsx`: extracted SessionCard frame/header from
  `src/app/shell/Sidebar.tsx`; T3 supplies status, navigation, rename and lifecycle.
- `ProjectGroupSection.tsx`: ProjectRail group structure with T3-local preferences.
- `donor-theme.css`: scoped donor tokens and original popover motion/backdrop;
  donor accent is named `monocode-accent` to preserve T3's neutral accent token.
- `ComposerModelMenu.tsx`: ModelPicker visual structure, with T3 provider/model
  selection behind it. Reasoning uses shared donor FilterControls separately.
- `ComposerAccessPicker.tsx`, `ComposerPlusMenu.tsx`: AccessPicker and Composer
  menu structure, adapted to T3 permissions, attachments and modes.
- `ComposerPickerTrigger.tsx`: source-control GitPickerTrigger; workspace and
  branch adapters retain T3 environments, remote branches and worktree actions.
- `SessionFiltersMenu.tsx`, `FilterControls.tsx`, `TerminalSpinner.tsx`: donor
  session filters and shared status visuals; filter data remains T3-owned.
- `../files/monocodeFileTreeDonor.ts`, `monocode-file-tree.css`: FileTree row
  metrics and status styling applied to T3's retained Pierre tree engine.
- `../files/monocodeMaterialIconPack.ts`: FileTypeIcon filename/compound-extension
  resolution adapted to a shared lazy Material icon sprite. Icon artwork comes
  from the separately licensed `react-material-icon-theme` dependency.

`MonocodeContextMenu.tsx` adapts T3's shared context-menu contract to ExplorerMenu,
including nested actions. ComposerSurface adapts the donor box/top-bar layout
without importing MonoCode's Tauri backend or stores.

Single-column nesting and T3 right-panel placement are intentional adaptations.

`../chat/MonocodeQueuedRunsCard.tsx` adapts the MessageQueue visual from the pinned
Composer.tsx; T3 retains queue persistence, holds, reorder, edit recovery and Steer.
`glassPopoverFrame.ts` shares the donor frame across Base UI popup owners.
