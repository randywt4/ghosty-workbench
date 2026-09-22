import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";
import "./monocode.css";

// Visual shell extracted from MonoCode Composer.tsx (bb3924b, data-composer-box).
// The editor, draft ownership, attachments and all callbacks remain T3's.
export function ComposerBox({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      {...props}
      data-composer-box
      className={cn(
        "monocode-composer relative z-10 rounded-lg border bg-foreground/3 backdrop-blur-sm border-foreground/10 focus-within:border-foreground/20",
        className,
      )}
    />
  );
}
