# MonoCode UI reuse

Source: https://github.com/hardbeat920/monocode/tree/bb3924b61f4d48ba12327ee1eb70a8b83d95e51d

The adjacent LICENSE and NOTICE apply to the imported material.

- `providers/*.svg`: unchanged `src/assets/providers/*.svg`.
- `HarnessIcon.tsx`: `src/features/sessions/ui/HarnessIcon.tsx`; adapted import paths and standalone harness type.
- `icons.tsx`: unchanged `src/shared/ui/icons.tsx`.
- `ComposerBox.tsx`: extracted visual box from `src/features/sessions/ui/Composer.tsx`; palette mapped to T3 theme tokens. T3 owns its editor and controls.
- `SessionRow.tsx`: adapted model-header for the legacy sidebar three-line card layout from `src/app/shell/Sidebar.tsx`. T3 owns navigation and lifecycle.
- `monocode.css`: adapted composer height, toolbar, primary action and session-row spacing from the same pinned source; theme colors and mobile touch targets follow T3.

This imports the requested visual portions, not MonoCode's Tauri runtime or session store.

`ComposerControl.tsx` adapts the donor ModelPicker and AccessPicker trigger classes; `ComposerPrimaryActions.tsx` adapts ComposerAction sizing and icons. LegacySidebar adapts the donor model/title/checkout ordering. T3 retains its menus, provider controls, project groups, and lifecycle actions. The activity sidebar is unchanged; new profiles default to legacy mode.
