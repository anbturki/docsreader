import {
  Columns2,
  ListCollapse,
  ListTree,
  Moon,
  RefreshCw,
  Rows2,
  Search,
  Settings as SettingsIcon,
  Square,
  Sun,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PathBreadcrumb } from "@/components/document/PathBreadcrumb";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";
import { displayShortcut } from "@/lib/shortcuts";
import { isMac } from "@/lib/platform";
import type { SplitMode } from "@/lib/storage";

const CHROME_ICON = "size-6 text-muted-foreground hover:text-foreground [&>svg]:size-4";

interface Props {
  roots: string[];
  activeRoot: string | undefined;
  workspaceNamesByRoot: Record<string, string>;
  onSelectRoot: (path: string) => void;
  onRemoveRoot: (path: string) => void;
  onPickDirectory: () => void;

  breadcrumbPath: string | undefined;
  onBreadcrumbSegmentClick: (segment: string) => void;

  quickOpenShortcut: string;
  onOpenQuickOpen: () => void;

  scanning: boolean;
  onRefresh: () => void;
  canCollapseAll: boolean;
  onCollapseAll: () => void;

  split: SplitMode;
  onSplitChange: (split: SplitMode) => void;

  canToggleOutline: boolean;
  outlineOpen: boolean;
  onToggleOutline: () => void;

  isDark: boolean;
  onToggleTheme: () => void;

  onOpenSettings: () => void;
  onPrefetchSettings: () => void;
}

export function AppToolbar({
  roots,
  activeRoot,
  workspaceNamesByRoot,
  onSelectRoot,
  onRemoveRoot,
  onPickDirectory,
  breadcrumbPath,
  onBreadcrumbSegmentClick,
  quickOpenShortcut,
  onOpenQuickOpen,
  scanning,
  onRefresh,
  canCollapseAll,
  onCollapseAll,
  split,
  onSplitChange,
  canToggleOutline,
  outlineOpen,
  onToggleOutline,
  isDark,
  onToggleTheme,
  onOpenSettings,
  onPrefetchSettings,
}: Props) {
  return (
    <header
      data-tauri-drag-region
      data-slot="app-toolbar"
      className={`fixed inset-x-0 top-0 z-30 flex h-(--toolbar-height) items-center gap-2 border-b bg-background pr-2 ${
        isMac ? "pl-(--window-controls-inset)" : "pl-2"
      }`}
    >
      {roots.length > 0 && (
        <div data-slot="workspace-switcher-slot" className="max-w-48 shrink-0">
          <WorkspaceSwitcher
            roots={roots}
            activeRoot={activeRoot}
            workspaceNamesByRoot={workspaceNamesByRoot}
            onSelect={onSelectRoot}
            onRemove={onRemoveRoot}
            onAdd={onPickDirectory}
          />
        </div>
      )}
      {breadcrumbPath && (
        <PathBreadcrumb
          relPath={breadcrumbPath}
          onSegmentClick={onBreadcrumbSegmentClick}
        />
      )}

      <div data-tauri-drag-region className="flex-1" />
      <button
        type="button"
        onClick={onOpenQuickOpen}
        className="flex h-7 w-52 items-center gap-2 rounded-md border bg-muted/40 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted"
      >
        <Search className="size-3.5" />
        <span>Search</span>
        <kbd className="ml-auto rounded border bg-background px-1.5 font-mono text-[10px] leading-4">
          {displayShortcut(quickOpenShortcut)}
        </kbd>
      </button>
      <div data-tauri-drag-region className="flex-1" />

      <div className="flex items-center gap-0.5">
        {activeRoot && (
          <Button
            size="icon"
            variant="ghost"
            className={CHROME_ICON}
            title="Refresh workspace"
            aria-label="Refresh workspace"
            disabled={scanning}
            onClick={onRefresh}
          >
            <RefreshCw className={scanning ? "animate-spin" : ""} />
          </Button>
        )}
        {canCollapseAll && (
          <Button
            size="icon"
            variant="ghost"
            className={CHROME_ICON}
            title="Collapse all"
            aria-label="Collapse all"
            onClick={onCollapseAll}
          >
            <ListCollapse />
          </Button>
        )}
        <ToggleGroup
          type="single"
          value={split}
          onValueChange={(v) => v && onSplitChange(v as SplitMode)}
          variant="outline"
          spacing={0}
          aria-label="Split layout"
          className="mx-1"
        >
          <ToggleGroupItem value="off" className="size-6" title="Single pane" aria-label="Single pane">
            <Square className="size-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="horizontal" className="size-6" title="Side by side" aria-label="Side by side">
            <Columns2 className="size-3.5" />
          </ToggleGroupItem>
          <ToggleGroupItem value="vertical" className="size-6" title="Stacked" aria-label="Stacked">
            <Rows2 className="size-3.5" />
          </ToggleGroupItem>
        </ToggleGroup>
        {canToggleOutline && (
          <Button
            size="icon"
            variant="ghost"
            className={`${CHROME_ICON} aria-pressed:bg-accent aria-pressed:text-foreground`}
            title={outlineOpen ? "Hide outline" : "Show outline"}
            aria-label="Toggle outline"
            aria-pressed={outlineOpen}
            onClick={onToggleOutline}
          >
            <ListTree />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className={CHROME_ICON}
          title="Toggle light / dark"
          aria-label="Toggle theme"
          onClick={onToggleTheme}
        >
          {isDark ? <Sun /> : <Moon />}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className={CHROME_ICON}
          title="Settings"
          aria-label="Settings"
          onMouseEnter={onPrefetchSettings}
          onFocus={onPrefetchSettings}
          onClick={onOpenSettings}
        >
          <SettingsIcon />
        </Button>
      </div>
    </header>
  );
}
