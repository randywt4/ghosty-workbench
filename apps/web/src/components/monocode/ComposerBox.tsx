import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";
import "./monocode.css";

// Visual shell copied from MonoCode Composer.tsx data-composer-box (bb3924b).
// monocode-surface scopes the donor tokens (bg-content, border-content, …)
// to the composer subtree; the editor, drafts, attachments and all callbacks
// remain T3's. Donor accent is monocode-accent in this port.
export function ComposerBox({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-composer-box
      className={cn(
        "monocode-composer monocode-surface relative z-10 rounded-lg border border-content/10 bg-content/3 backdrop-blur-sm focus-within:border-content/20",
        className,
      )}
    />
  );
}
