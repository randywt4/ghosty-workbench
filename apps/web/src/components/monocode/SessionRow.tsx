import type { ReactNode } from "react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import "./monocode.css";

// Adapted from MonoCode Sidebar.tsx SessionRow at bb3924b. T3 retains selection,
// routing, status and lifecycle actions; only the three-line presentation is shared.
export function SessionRowHeader({
  icon,
  model,
  children,
}: {
  icon: ReactNode;
  model: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex min-w-0 items-center gap-2">
      <span className="flex min-w-0 flex-1 items-center gap-1.5">
        {icon}
        <Tooltip>
          <TooltipTrigger
            render={<span className="min-w-0 truncate text-[11px] text-content/50" />}
          >
            {model}
          </TooltipTrigger>
          <TooltipPopup>{model}</TooltipPopup>
        </Tooltip>
      </span>
      {children}
    </div>
  );
}
