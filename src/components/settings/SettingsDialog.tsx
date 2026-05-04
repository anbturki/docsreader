import { useState } from "react";
import { BookOpen, FolderTree, Keyboard, Palette } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ViewSettings } from "@/lib/storage";
import { AppearanceSection } from "./AppearanceSection";
import { ExplorerSection } from "./ExplorerSection";
import { ReadingSection } from "./ReadingSection";
import { ShortcutsSection } from "./ShortcutsSection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
}

type SectionId = "appearance" | "reading" | "explorer" | "shortcuts";

const SECTIONS: { id: SectionId; label: string; icon: typeof Palette }[] = [
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "reading", label: "Reading", icon: BookOpen },
  { id: "explorer", label: "Explorer", icon: FolderTree },
  { id: "shortcuts", label: "Shortcuts", icon: Keyboard },
];

export default function SettingsDialog({ open, onOpenChange, settings, onChange }: Props) {
  const [active, setActive] = useState<SectionId>("appearance");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-w-3xl gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="border-b px-5 py-3">
          <DialogTitle className="text-base font-semibold">Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-[520px]">
          <nav className="w-44 shrink-0 border-r bg-muted/30 p-2">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActive(id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                  active === id
                    ? "bg-primary/10 text-primary"
                    : "text-foreground/80 hover:bg-accent"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {active === "appearance" && (
              <AppearanceSection settings={settings} onChange={onChange} />
            )}
            {active === "reading" && (
              <ReadingSection settings={settings} onChange={onChange} />
            )}
            {active === "explorer" && (
              <ExplorerSection settings={settings} onChange={onChange} />
            )}
            {active === "shortcuts" && (
              <ShortcutsSection settings={settings} onChange={onChange} />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
