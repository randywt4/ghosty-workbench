/**
 * Shared donor glass frame for every Base UI popup surface.
 *
 * Pinned donor: MonoCode `bb3924b61f4d48ba12327ee1eb70a8b83d95e51d`
 * (`src/features/.../Popover.tsx` FRAME + `GlassBackdrop`, transplanted in
 * `apps/web/src/components/monocode/Popover.tsx` with `monocode-surface`
 * scoping for T3 themes).
 *
 * Actual visual dependency (do not approximate or duplicate):
 * - Frame: `monocode-surface` (donor tokens + `color: var(--color-content)`)
 *   + `isolate overflow-hidden rounded-xl border border-content/10 shadow-xl`.
 * - Backdrop: sibling `<GlassBackdrop />` (`pointer-events-none absolute
 *   inset-0 z-0 rounded-[inherit] backdrop-blur-xl popover-backdrop`).
 *   Neither the frame nor the backdrop animates transform/opacity.
 * - Content: `relative z-[1]` layer that owns the open animation
 *   (`popover-open` in `donor-theme.css`, or Base UI
 *   `origin-(--transform-origin)` on the same layer).
 *
 * Base UI surfaces (`ui/popover.tsx`, `ui/select.tsx`, `ui/combobox.tsx`,
 * `ui/menu.tsx`) must compose this exact frame + backdrop instead of the
 * legacy `dropdown-glass` opaque fill, and keep open scale/opacity animation
 * on the `relative z-[1]` content only so backdrop-filter stays stable
 * (WebKit stale-backdrop guard in the donor comment).
 *
 * Primary / ThreadDetails consumer interface: import
 * `GLASS_POPOVER_FRAME_CLASS_NAME` and `GlassBackdrop` from this module.
 * `GLASS_POPOVER_CONTENT_CLASS_NAME` is the `relative z-[1]` content layer.
 */

export const GLASS_POPOVER_FRAME_CLASS_NAME =
  "monocode-surface isolate overflow-hidden rounded-xl border border-content/10 shadow-xl";

export const GLASS_POPOVER_CONTENT_CLASS_NAME = "relative z-[1]";

export { GlassBackdrop } from "./GlassBackdrop";
