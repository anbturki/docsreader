import { useMemo, useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ExplorerSidebar } from "@/components/explorer/ExplorerSidebar";
import { DocumentView } from "@/components/document/DocumentView";
import { EmptyDocument } from "@/components/document/EmptyDocument";
import { PathBreadcrumb } from "@/components/document/PathBreadcrumb";
import { SettingsDialog } from "@/components/settings/SettingsDialog";
import { useLibrary } from "@/hooks/useLibrary";
import { useDocument } from "@/hooks/useDocument";
import { useTheme } from "@/hooks/useTheme";
import { useViewSettings } from "@/hooks/useViewSettings";
import { buildTree } from "@/lib/tree";
import type { MarkdownFile } from "@/lib/scan";
import "@/styles/code-theme.css";

function App() {
  const library = useLibrary();
  const document = useDocument();
  const viewSettings = useViewSettings();
  useTheme(viewSettings.settings.colorScheme, viewSettings.settings.accentColor);
  const [search, setSearch] = useState("");
  const [treeVersion, setTreeVersion] = useState(0);

  const filteredFiles = useFilteredFiles(library.activeScan?.result.files ?? [], search);
  const tree = useMemo(
    () => (library.activeRoot ? buildTree(library.activeRoot, filteredFiles) : undefined),
    [library.activeRoot, filteredFiles]
  );
  const tags = useTags(library.activeScan?.result.files ?? []);
  const selectedFile = filteredFiles.find((f) => f.path === document.selectedPath);

  return (
    <TooltipProvider delayDuration={200}>
      <SidebarProvider>
        <ExplorerSidebar
          roots={library.roots}
          activeRoot={library.activeRoot}
          activeScan={library.activeScan}
          selectedPath={document.selectedPath}
          search={search}
          filteredFiles={filteredFiles}
          tags={tags}
          tree={tree}
          treeVersion={treeVersion}
          onPickDirectory={() => void library.pickDirectory()}
          onSelectRoot={(path) => void library.selectRoot(path)}
          onRemoveRoot={(path) => void library.removeRoot(path)}
          onRescan={() => library.activeRoot && void library.rescan(library.activeRoot)}
          onCollapseAll={() => setTreeVersion((v) => v + 1)}
          onSearchChange={setSearch}
          onSelectFile={(path) => void document.openFile(path)}
        />

        <SidebarInset className="flex flex-col">
          <header className="flex items-center gap-2 px-4 py-3 border-b bg-background sticky top-0 z-10">
            <SidebarTrigger />
            {selectedFile && (
              <PathBreadcrumb
                relPath={selectedFile.relPath}
                onSegmentClick={setSearch}
              />
            )}
            <div className="ml-auto flex items-center gap-1">
              <SettingsDialog
                settings={viewSettings.settings}
                onChange={viewSettings.update}
              />
            </div>
          </header>

          <div className="flex-1 overflow-y-auto">
            {selectedFile ? (
              <DocumentView
                file={selectedFile}
                content={document.content}
                meta={document.meta}
                loading={document.loading}
                error={document.error}
                rootPath={library.activeRoot}
                viewSettings={viewSettings.settings}
                onNavigate={(path) => void document.openFile(path)}
              />
            ) : (
              <EmptyDocument hasRoots={library.roots.length > 0} />
            )}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

function useFilteredFiles(files: MarkdownFile[], search: string): MarkdownFile[] {
  return useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      if (f.name.toLowerCase().includes(q)) return true;
      if (f.relPath.toLowerCase().includes(q)) return true;
      if (f.title?.toLowerCase().includes(q)) return true;
      return f.tags.some((t) => t.toLowerCase().includes(q));
    });
  }, [files, search]);
}

function useTags(files: MarkdownFile[]): string[] {
  return useMemo(() => {
    const tags = new Set<string>();
    files.forEach((f) => f.tags.forEach((t) => tags.add(t)));
    return Array.from(tags).sort();
  }, [files]);
}

export default App;
