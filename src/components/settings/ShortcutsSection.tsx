import { defaultViewSettings, type ViewSettings } from "@/lib/storage";
import { ShortcutRecorder } from "./ShortcutRecorder";

interface Props {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
}

export function ShortcutsSection({ settings, onChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <Field
        label="Quick open"
        hint="Open the file switcher. Click the field, then press your combo."
      >
        <ShortcutRecorder
          value={settings.quickOpenShortcut}
          defaultValue={defaultViewSettings.quickOpenShortcut}
          onChange={(v) => onChange({ ...settings, quickOpenShortcut: v })}
        />
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
    <div className="flex flex-col gap-1.5">
      <div>
        <div className="text-[13px] font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      {children}
    </div>
  );
}
