import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { captureShortcut, displayShortcut } from "@/lib/shortcuts";

interface Props {
  value: string;
  defaultValue: string;
  onChange: (next: string) => void;
}

export function ShortcutRecorder({ value, defaultValue, onChange }: Props) {
  const [recording, setRecording] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const stop = () => {
    setRecording(false);
    ref.current?.blur();
  };

  return (
    <div className="flex items-center gap-2">
      <button
        ref={ref}
        type="button"
        onClick={() => setRecording((r) => !r)}
        onBlur={() => setRecording(false)}
        onKeyDown={(e) => {
          if (!recording) return;
          if (e.key === "Escape") {
            e.preventDefault();
            stop();
            return;
          }
          const captured = captureShortcut(e.nativeEvent);
          if (!captured) return;
          e.preventDefault();
          e.stopPropagation();
          onChange(captured);
          stop();
        }}
        className={cn(
          "inline-flex h-9 min-w-32 items-center justify-center rounded-md border px-3 text-sm font-mono",
          "transition-colors",
          recording
            ? "border-primary bg-primary/10 text-primary"
            : "border-input bg-background hover:bg-accent"
        )}
      >
        {recording ? "Press a combo…" : displayShortcut(value)}
      </button>
      {value !== defaultValue && (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange(defaultValue)}
        >
          Reset
        </Button>
      )}
    </div>
  );
}
