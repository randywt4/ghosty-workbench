import { normalizeProjectPathForComparison } from "./lib/projectPaths";

/** Device-local presentation. Project titles and logos retain their server owners. */
export interface ProjectAppearance {
  color?: string;
  mascot?: string;
  group?: string;
  pinned?: boolean;
  archived?: boolean;
  mutedUntil?: number;
}

type AppearanceProject = {
  environmentId: string;
  workspaceRoot: string;
  memberProjects?: readonly { environmentId: string; workspaceRoot: string }[];
};

export function projectAppearanceKey(project: AppearanceProject): string {
  if (project.memberProjects?.length)
    return project.memberProjects.map(projectAppearanceKey).sort()[0]!;
  return `${project.environmentId}:${normalizeProjectPathForComparison(project.workspaceRoot)}`;
}

/** Keep a logical project's appearance stable when T3 changes its representative host. */
export function resolveProjectAppearance(
  project: AppearanceProject,
  appearances: Record<string, ProjectAppearance> | undefined,
): ProjectAppearance | undefined {
  const members = project.memberProjects?.length ? project.memberProjects : [project];
  const entries = members
    .map((member) => ({
      key: projectAppearanceKey(member),
      appearance: appearances?.[projectAppearanceKey(member)],
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const canonical = entries.find(
    (entry) => entry.appearance && Object.keys(entry.appearance).length > 0,
  )?.appearance;
  if (!canonical) return undefined;
  if (entries.length === 1) return canonical;
  return {
    ...canonical,
    pinned: entries.some((entry) => entry.appearance?.pinned === true),
    // A partially archived group must not hide its still-active members.
    archived: entries.every((entry) => entry.appearance?.archived === true),
  };
}

/** Pinned projects and named groups are separate reorder lanes. */
export function projectAppearanceLane(appearance: ProjectAppearance | undefined): string {
  return appearance?.pinned ? "pinned" : `group:${appearance?.group ?? ""}`;
}

export function sanitizeProjectAppearance(value: unknown): Record<string, ProjectAppearance> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const result: Record<string, ProjectAppearance> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (!key || !entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = entry as Record<string, unknown>;
    const appearance: ProjectAppearance = {};
    if (typeof item.color === "string" && /^#[\da-f]{6}$/i.test(item.color))
      appearance.color = item.color;
    if (typeof item.mascot === "string" && /^[a-z-]{1,32}$/.test(item.mascot))
      appearance.mascot = item.mascot;
    if (typeof item.group === "string") appearance.group = item.group.trim().slice(0, 80);
    if (typeof item.pinned === "boolean") appearance.pinned = item.pinned;
    if (typeof item.archived === "boolean") appearance.archived = item.archived;
    if (
      typeof item.mutedUntil === "number" &&
      Number.isFinite(item.mutedUntil) &&
      item.mutedUntil >= 0
    )
      appearance.mutedUntil = item.mutedUntil;
    result[key] = appearance;
  }
  return result;
}

export function projectNotificationsMuted(
  appearance: ProjectAppearance | undefined,
  now = Date.now(),
): boolean {
  return appearance?.mutedUntil === 0 || (appearance?.mutedUntil ?? -1) > now;
}

// MonoCode tabGroups.ts palette at bb3924b, expressed as hex for the native color input.
export const PROJECT_ACCENT_COLORS = [
  "#8b939b",
  "#459bf7",
  "#ea6145",
  "#f4c525",
  "#39c66d",
  "#e65ba0",
  "#b369d3",
  "#37beb3",
  "#ef852f",
] as const;
