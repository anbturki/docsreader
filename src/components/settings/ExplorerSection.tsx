import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { DefaultFolderState, ViewSettings } from "@/lib/storage";

interface Props {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
  onOpenWelcome: () => void;
}

const pillClass =
  "h-11 rounded-lg border bg-card text-card-foreground transition-colors text-sm font-medium " +
  "hover:bg-accent " +
  "data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40 " +
  "data-[state=on]:hover:bg-primary/15";

export function ExplorerSection({ settings, onChange, onOpenWelcome }: Props) {
  const [draft, setDraft] = useState("");

  const addPattern = (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    if (settings.hidePatterns.includes(value)) {
      setDraft("");
      return;
    }
    onChange({ ...settings, hidePatterns: [...settings.hidePatterns, value] });
    setDraft("");
  };

  const removePattern = (value: string) => {
    onChange({
      ...settings,
      hidePatterns: settings.hidePatterns.filter((p) => p !== value),
    });
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addPattern(draft);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Field
        label="Default folder state"
        hint="Folders you have not explicitly opened or closed will start in this state."
      >
        <ToggleGroup
          type="single"
          value={settings.defaultFolderState}
          onValueChange={(v) =>
            v && onChange({ ...settings, defaultFolderState: v as DefaultFolderState })
          }
          variant="outline"
          spacing={8}
          className="grid w-full grid-cols-3"
        >
          <ToggleGroupItem value="expanded" className={pillClass}>
            All open
          </ToggleGroupItem>
          <ToggleGroupItem value="top-level" className={pillClass}>
            Top level only
          </ToggleGroupItem>
          <ToggleGroupItem value="collapsed" className={pillClass}>
            All closed
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>

      <Field
        label="Hide files and folders"
        hint="Glob patterns - drafts/**, *.private.md, node_modules. Plain names match anywhere; patterns with / match the relative path."
      >
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder="drafts/**"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
          />
          <Button type="button" variant="outline" onClick={() => addPattern(draft)}>
            Add
          </Button>
        </div>
        {settings.hidePatterns.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {settings.hidePatterns.map((p) => (
              <li
                key={p}
                className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-1 text-sm"
              >
                <code className="font-mono text-xs">{p}</code>
                <button
                  type="button"
                  onClick={() => removePattern(p)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${p}`}
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            No patterns yet. Right-click a file in the explorer to hide it quickly.
          </p>
        )}
      </Field>

      <Field
        label="Welcome workspace"
        hint="The welcome workspace is your own copy at ~/Library/Application Support/DocsReader/welcome. Re-adding does not overwrite your edits."
      >
        <Button
          type="button"
          variant="outline"
          onClick={onOpenWelcome}
          className="self-start"
        >
          Open welcome workspace
        </Button>
      </Field>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
