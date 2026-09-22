import { ComposerBox } from "../monocode/ComposerBox";
import type { ComponentProps } from "react";
import { cn } from "~/lib/utils";

/** T3 owns composer state and measurement; MonoCode owns the single visible box. */
function Shell({
  contextStrip = false,
  className,
  ...props
}: ComponentProps<"div"> & { contextStrip?: boolean }) {
  return (
    <div
      data-slot="composer-shell"
      data-with-context={contextStrip || undefined}
      className={cn(
        "monocode-surface @container/composer-surface group/composer-surface relative isolate mx-auto w-full max-w-(--chat-content-max-width)",
        "[--chat-composer-drawer-inset:0px] [--chat-composer-glass-surface:var(--color-background-base)]",
        className,
      )}
      {...props}
    />
  );
}

function Host({ className, ...props }: ComponentProps<"div">) {
  return (
    <div data-slot="composer-host" className={cn("relative z-10 w-full", className)} {...props} />
  );
}

function Main({ className, ...props }: ComponentProps<"div">) {
  return (
    <ComposerBox
      data-chat-composer-main-surface="true"
      className={cn("group", className)}
      {...props}
    />
  );
}

/** MonoCode Composer.tsx top bar; retained T3 workspace controls fill the slots. */
function ContextStrip({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="composer-context-strip"
      className={cn(
        "group/composer-context relative flex min-w-0 items-center gap-2.5 px-3 pt-2.5 text-content/50",
        className,
      )}
      {...props}
    />
  );
}

export const ComposerSurface = { Shell, Host, Main, ContextStrip };
