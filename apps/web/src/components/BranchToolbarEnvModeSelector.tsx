import { ComposerContextLabel } from "./ComposerContextLabel";
import { FolderGit2Icon, FolderGitIcon, FolderIcon, HistoryIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { cn } from "../lib/utils";
import { Folder, FolderTree } from "./monocode/icons";
import { composerPickerTriggerClassName } from "./monocode/ComposerPickerTrigger";
import "./monocode/composer-picker.css";
import {
  THREAD_DETAILS_PANEL_ICON_CLASS,
  THREAD_DETAILS_PANEL_LOCKED_ROW_CLASS,
  THREAD_DETAILS_PANEL_ROW_POPUP_CLASS,
  THREAD_DETAILS_PANEL_SELECT_ROW_CLASS,
} from "./chat/threadDetailsPanelStyles";

import {
  resolveCurrentWorkspaceLabel,
  resolveEnvModeLabel,
  resolveLockedWorkspaceLabel,
  resolveWorkspaceDisplayName,
  type EnvMode,
} from "./BranchToolbar.logic";
import { useComposerMenuProps } from "./chat/composerEventScope";
import {
  Select,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Tooltip, TooltipPopup, TooltipTrigger } from "./ui/tooltip";

const PREVIOUS_WORKTREE_SELECT_VALUE = "previous-worktree";

interface BranchToolbarEnvModeSelectorProps {
  forceNewWorktree?: boolean;
  envLocked: boolean;
  effectiveEnvMode: EnvMode;
  activeWorktreePath: string | null;
  workspaceRoot?: string | null;
  onEnvModeChange: (mode: EnvMode) => void;
  displayMode?: "toolbar" | "panel";
  previousWorktreeLabel?: string | null;
  onUsePreviousWorktree?: () => void;
}

export const BranchToolbarEnvModeSelector = memo(function BranchToolbarEnvModeSelector({
  forceNewWorktree = false,
  envLocked,
  effectiveEnvMode,
  activeWorktreePath,
  workspaceRoot = null,
  onEnvModeChange,
  displayMode = "toolbar",
  previousWorktreeLabel,
  onUsePreviousWorktree,
}: BranchToolbarEnvModeSelectorProps) {
  const workspacePath = displayMode === "panel" ? (activeWorktreePath ?? workspaceRoot) : null;
  const workspaceDisplayName = resolveWorkspaceDisplayName(workspacePath);
  const workspaceKind = activeWorktreePath ? "Worktree" : "Project folder";
  const composerFloatingLayerProps = useComposerMenuProps();
  const showPreviousWorktree = Boolean(previousWorktreeLabel && onUsePreviousWorktree);
  const envModeItems = useMemo(
    () => [
      {
        value: "local",
        label: workspaceDisplayName ?? resolveCurrentWorkspaceLabel(activeWorktreePath),
      },
      { value: "worktree", label: resolveEnvModeLabel("worktree") },
      ...(showPreviousWorktree && previousWorktreeLabel
        ? [{ value: PREVIOUS_WORKTREE_SELECT_VALUE, label: previousWorktreeLabel }]
        : []),
    ],
    [activeWorktreePath, previousWorktreeLabel, showPreviousWorktree, workspaceDisplayName],
  );

  if (envLocked || forceNewWorktree) {
    const lockedRow = (
      <span
        className={cn(
          displayMode === "panel"
            ? cn(
                "inline-flex h-7 min-w-0 items-center gap-1 border border-transparent px-[calc(--spacing(2)-1px)] font-normal text-muted-foreground/70 text-xs sm:h-6",
                THREAD_DETAILS_PANEL_LOCKED_ROW_CLASS,
              )
            : "monocode-surface inline-flex h-6 min-w-fit shrink-0 items-center gap-1.5 px-1.5 text-[12px] text-content/45",
        )}
        data-composer-context-control
      >
        {displayMode === "panel" ? (
          forceNewWorktree ? (
            <FolderGit2Icon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
          ) : activeWorktreePath ? (
            <FolderGitIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
          ) : (
            <FolderIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
          )
        ) : forceNewWorktree || effectiveEnvMode === "worktree" ? (
          <FolderTree className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <Folder className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <ComposerContextLabel displayMode={displayMode}>
          {forceNewWorktree
            ? resolveEnvModeLabel("worktree")
            : (workspaceDisplayName ?? resolveLockedWorkspaceLabel(activeWorktreePath))}
        </ComposerContextLabel>
        {displayMode === "panel" ? (
          <span className="shrink-0 text-[10px] font-normal text-muted-foreground/70">
            {forceNewWorktree ? "Worktree" : workspaceKind}
          </span>
        ) : null}
      </span>
    );

    return (
      <Tooltip>
        <TooltipTrigger render={lockedRow} />
        <TooltipPopup side={displayMode === "panel" ? "left" : undefined}>
          {forceNewWorktree
            ? "Each model starts in its own worktree."
            : (workspacePath ?? resolveLockedWorkspaceLabel(activeWorktreePath))}
        </TooltipPopup>
      </Tooltip>
    );
  }

  return (
    <Select
      modal={false}
      value={effectiveEnvMode}
      onValueChange={(value: string | null) => {
        if (value === PREVIOUS_WORKTREE_SELECT_VALUE) {
          onUsePreviousWorktree?.();
          return;
        }
        onEnvModeChange(value as EnvMode);
      }}
      items={envModeItems}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <SelectTrigger
              variant="ghost"
              size={displayMode === "panel" ? "default" : "xs"}
              className={cn(
                displayMode === "panel"
                  ? cn("min-w-0 shrink font-normal text-xs!", THREAD_DETAILS_PANEL_SELECT_ROW_CLASS)
                  : composerPickerTriggerClassName("max-w-48"),
              )}
              icon={
                displayMode === "panel" ? undefined : <span aria-hidden="true" className="hidden" />
              }
              aria-label="Workspace"
              data-composer-shortcut="composer.workspace"
              data-composer-context-control
            />
          }
        >
          {displayMode === "panel" ? (
            effectiveEnvMode === "worktree" ? (
              <FolderGit2Icon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
            ) : activeWorktreePath ? (
              <FolderGitIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
            ) : (
              <FolderIcon className={THREAD_DETAILS_PANEL_ICON_CLASS} />
            )
          ) : effectiveEnvMode === "worktree" ? (
            <FolderTree className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Folder className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <ComposerContextLabel displayMode={displayMode}>
            <SelectValue />
          </ComposerContextLabel>
          {displayMode === "panel" ? (
            <span className="shrink-0 text-[10px] font-normal text-muted-foreground/70">
              {effectiveEnvMode === "worktree" && !activeWorktreePath ? "Create" : workspaceKind}
            </span>
          ) : null}
        </TooltipTrigger>
        <TooltipPopup side={displayMode === "panel" ? "left" : undefined}>
          {workspacePath ??
            (effectiveEnvMode === "worktree"
              ? resolveEnvModeLabel("worktree")
              : resolveCurrentWorkspaceLabel(activeWorktreePath))}
        </TooltipPopup>
      </Tooltip>
      <SelectPopup
        alignItemWithTrigger={false}
        {...(displayMode === "toolbar" ? composerFloatingLayerProps : {})}
        {...(displayMode === "panel"
          ? {
              popupClassName: THREAD_DETAILS_PANEL_ROW_POPUP_CLASS,
            }
          : {
              popupClassName: "monocode-surface monocode-composer-picker w-60",
            })}
      >
        <SelectGroup>
          <SelectGroupLabel>Workspace</SelectGroupLabel>
          <SelectItem
            value="local"
            className={displayMode === "toolbar" ? "h-9 gap-2 px-2 text-[13px]" : undefined}
          >
            <span className="inline-flex items-center gap-2">
              {displayMode === "panel" ? (
                activeWorktreePath ? (
                  <FolderGitIcon className="size-3" />
                ) : (
                  <FolderIcon className="size-3" />
                )
              ) : (
                <Folder className="size-4 shrink-0 text-content/55" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate">
                {resolveCurrentWorkspaceLabel(activeWorktreePath)}
              </span>
            </span>
          </SelectItem>
          <SelectItem
            value="worktree"
            className={displayMode === "toolbar" ? "h-9 gap-2 px-2 text-[13px]" : undefined}
          >
            <span className="inline-flex items-center gap-2">
              {displayMode === "panel" ? (
                <FolderGit2Icon className="size-3" />
              ) : (
                <FolderTree className="size-4 shrink-0 text-content/55" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1 truncate">{resolveEnvModeLabel("worktree")}</span>
            </span>
          </SelectItem>
          {showPreviousWorktree && previousWorktreeLabel ? (
            <SelectItem
              value={PREVIOUS_WORKTREE_SELECT_VALUE}
              className={displayMode === "toolbar" ? "h-9 gap-2 px-2 text-[13px]" : undefined}
            >
              <span className="inline-flex items-center gap-2">
                <HistoryIcon
                  className={displayMode === "panel" ? "size-3" : "size-4 shrink-0 text-content/55"}
                />
                <span className="min-w-0 flex-1 truncate">{previousWorktreeLabel}</span>
              </span>
            </SelectItem>
          ) : null}
        </SelectGroup>
      </SelectPopup>
    </Select>
  );
});
