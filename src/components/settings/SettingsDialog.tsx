import { useEffect, useState } from "react";
import { BookOpen, Bot, FolderTree, Keyboard, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ViewSettings } from "@/lib/storage";
import { AgentsSection } from "./AgentsSection";
import { AppearanceSection } from "./AppearanceSection";
import { ExplorerSection } from "./ExplorerSection";
import { ReadingSection } from "./ReadingSection";
import { ShortcutsSection } from "./ShortcutsSection";

const SECTIONS = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "reading", label: "Reading", icon: BookOpen },
  { id: "explorer", label: "Explorer", icon: FolderTree },
  { id: "agents", label: "AI agents", icon: Bot },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
] as const;

export type SettingsSection = (typeof SECTIONS)[number]["id"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
  initialSection?: SettingsSection;
  onOpenWelcome: () => void;
}

export default function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onChange,
  initialSection,
  onOpenWelcome,
}: Props) {
  const [active, setActive] = useState<SettingsSection>(initialSection ?? "appearance");

  useEffect(() => {
    if (open && initialSection) setActive(initialSection);
  }, [open, initialSection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b px-4 py-2">
          <DialogTitle className="text-sm font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-[520px] min-w-0">
          <nav className="w-44 shrink-0 border-r bg-muted/30 py-2">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className={cn(
                  "flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-sm transition-colors",
                  active === id
                    ? "border-primary bg-accent font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto px-5 py-4">
            {active === "appearance" && (
              <AppearanceSection settings={settings} onChange={onChange} />
            )}
            {active === "reading" && (
              <ReadingSection settings={settings} onChange={onChange} />
            )}
            {active === "explorer" && (
              <ExplorerSection
                settings={settings}
                onChange={onChange}
                onOpenWelcome={onOpenWelcome}
              />
            )}
            {active === "agents" && <AgentsSection />}
            {active === "shortcuts" && (
              <ShortcutsSection settings={settings} onChange={onChange} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
