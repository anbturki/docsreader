import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import type { MarkdownFile } from "@/lib/scan";
import type { ViewSettings } from "@/lib/storage";
import type { Tab } from "@/hooks/useTabs";
import { parseFrontmatter } from "@/lib/scan";
import { useFindInDocument } from "@/hooks/useFindInDocument";
import { matchShortcut, parseShortcut } from "@/lib/shortcuts";
import { DocumentView } from "./DocumentView";
import { ExternalChangeBanner } from "./ExternalChangeBanner";
import { FindBar } from "./FindBar";


interface Props {
  tab: Tab;
  file: MarkdownFile | undefined;
  active: boolean;
  rootPath: string | undefined;
  viewSettings: ViewSettings;
  initialScrollTop: number;
  onScrollChange: (path: string, value: number) => void;
  onNavigate: (path: string) => void;
  onActiveRefChange?: (el: HTMLElement | null) => void;
  /** False when a split is showing and the other pane holds focus. */
  paneFocused: boolean;
  onAcceptPending: (id: string) => void;
  onDismissPending: (id: string) => void;
  onDiffViewModeChange: (mode: ViewSettings["diffViewMode"]) => void;
  onAlwaysAutoReload: () => void;
  onBeginEdit: (id: string) => Promise<void>;
  onCancelEdit: (id: string) => void;
  onSaveEdit: (id: string, markdown: string) => Promise<void>;
  onToggleTask: (id: string, index: number) => Promise<void>;
}

export function TabScrollPane({
  tab,
  file,
  active,
  rootPath,
  viewSettings,
  initialScrollTop,
  onScrollChange,
  onNavigate,
  onActiveRefChange,
  paneFocused,
  onAcceptPending,
  onDismissPending,
  onDiffViewModeChange,
  onAlwaysAutoReload,
  onBeginEdit,
  onCancelEdit,
  onSaveEdit,
  onToggleTask,
}: Props) {
  const pendingBody = useMemo(
    () => (tab.pendingContent ? parseFrontmatter(tab.pendingContent).content : undefined),
    [tab.pendingContent]
  );
  const ref = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);
  const [scrollEl, setScrollEl] = useState<HTMLElement | null>(null);

  useEffect(() => setScrollEl(ref.current), []);

  // Find applies to the rendered view only; the editor brings its own.
  const findShortcut = useMemo(
    () => parseShortcut(viewSettings.findInDocumentShortcut),
    [viewSettings.findInDocumentShortcut]
  );
  const findable = active && paneFocused && tab.draft === undefined;
  const find = useFindInDocument(findable ? scrollEl : null, findable);
  const showFind = find.show;

  useEffect(() => {
    if (!findable || !findShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      if (!matchShortcut(e, findShortcut)) return;
      e.preventDefault();
      showFind();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [findable, findShortcut, showFind]);

  useEffect(() => {
    restoredRef.current = false;
  }, [tab.path]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (restoredRef.current) return;
    if (tab.loading || tab.error) return;
    if (initialScrollTop === 0) {
      restoredRef.current = true;
      return;
    }

    const tryRestore = () => {
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 0) return false;
      el.scrollTop = Math.min(initialScrollTop, max);
      return Math.abs(el.scrollTop - initialScrollTop) < 2;
    };

    if (tryRestore()) {
      restoredRef.current = true;
      return;
    }

    const inner = el.firstElementChild;
    if (!inner) return;
    const observer = new ResizeObserver(() => {
      if (restoredRef.current) {
        observer.disconnect();
        return;
      }
      if (tryRestore()) {
        restoredRef.current = true;
        observer.disconnect();
      }
    });
    observer.observe(inner);
    const safety = window.setTimeout(() => {
      restoredRef.current = true;
      observer.disconnect();
    }, 4000);
    return () => {
      observer.disconnect();
      clearTimeout(safety);
    };
  }, [tab.loading, tab.error, tab.content, initialScrollTop]);

  useEffect(() => {
    if (!onActiveRefChange) return;
    if (active) {
      onActiveRefChange(ref.current);
      return () => onActiveRefChange(null);
    }
  }, [active, onActiveRefChange]);

  return (
    <div
      ref={ref}
      className={cn("absolute inset-0 overflow-y-auto", !active && "invisible")}
      aria-hidden={!active}
      onScroll={(e) => {
        if (!restoredRef.current) return;
        onScrollChange(tab.path, e.currentTarget.scrollTop);
      }}
    >
      {/* Sticky with no height so the bar stays pinned while the document
          scrolls beneath it without displacing the content. */}
      {find.open && (
        <div className="pointer-events-none sticky top-0 z-10 h-0">
          <div className="pointer-events-auto flex justify-end p-3">
            <FindBar find={find} />
          </div>
        </div>
      )}
      {tab.pendingContent && pendingBody !== undefined && (
        <ExternalChangeBanner
          before={tab.content}
          after={pendingBody}
          diffViewMode={viewSettings.diffViewMode}
          onDiffViewModeChange={onDiffViewModeChange}
          onReload={() => onAcceptPending(tab.id)}
          onDismiss={() => onDismissPending(tab.id)}
          onAlwaysAutoReload={onAlwaysAutoReload}
        />
      )}
      <DocumentView
        tab={tab}
        file={file}
        rootPath={rootPath}
        viewSettings={viewSettings}
        onNavigate={onNavigate}
        onBeginEdit={() => void onBeginEdit(tab.id)}
        onCancelEdit={() => onCancelEdit(tab.id)}
        onSaveEdit={(markdown) => onSaveEdit(tab.id, markdown)}
        onToggleTask={(index) => void onToggleTask(tab.id, index)}
      />
    </div>
  );
}
