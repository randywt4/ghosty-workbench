import type { ReactNode } from "react";
import { useUiStateStore } from "../../uiStateStore";
import { ChevronDown, ChevronRight } from "./icons";
import { ProjectMascot } from "./ProjectMascot";

/** Visible group structure from MonoCode ProjectRail.tsx ProjectGroupSection. */
export function ProjectGroupSection({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: ReactNode;
}) {
  const expanded = useUiStateStore((state) => state.projectGroupExpandedByName?.[name] ?? true);
  const setExpanded = useUiStateStore((state) => state.setProjectGroupExpanded);
  return (
    <li
      className={`shrink-0 overflow-hidden rounded-md ${expanded ? "mb-1.5 bg-content/5" : ""}`}
      data-project-group={name}
      role="group"
      aria-label={name}
    >
      <div className="project-reorder-item group relative flex h-8 items-stretch rounded-md px-2 opacity-65 cursor-default">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${name}, ${count} projects`}
          onClick={() => setExpanded(name, !expanded)}
          className="flex min-w-0 flex-1 cursor-default items-center gap-2 text-left transition-[padding] duration-150 motion-reduce:transition-none"
        >
          <div className="grid size-4 shrink-0 place-items-center">
            {expanded ? (
              <ChevronDown className="size-3.5" strokeWidth={1.75} />
            ) : (
              <>
                <span className="grid size-4 place-items-center group-hover:hidden group-has-[:focus-visible]:hidden">
                  <ProjectMascot project={name} className="size-3" />
                </span>
                <ChevronRight
                  className="hidden size-3.5 group-hover:block group-has-[:focus-visible]:block"
                  strokeWidth={1.75}
                />
              </>
            )}
          </div>
          <span className="min-w-0 truncate text-sm font-medium">{name}</span>
        </button>
      </div>
      {expanded ? (
        <ul data-project-group-items className="flex flex-col gap-px p-1">
          {children}
        </ul>
      ) : null}
    </li>
  );
}
