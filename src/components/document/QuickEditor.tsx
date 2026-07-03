import { useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  value: string;
  error: string | undefined;
  onChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  onCancel: () => void;
}

const isMac = navigator.platform.toUpperCase().includes("MAC");

export function QuickEditor({ value, error, onChange, onSave, onCancel }: Props) {
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      void save();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoFocus
        spellCheck={false}
        aria-label="Edit markdown source"
        className="min-h-[55vh] w-full resize-y rounded-md border bg-card p-4 font-mono text-sm leading-relaxed focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <span className="text-xs text-muted-foreground">
          {isMac ? "⌘S" : "Ctrl+S"} to save · Esc to cancel
        </span>
      </div>
    </div>
  );
}
