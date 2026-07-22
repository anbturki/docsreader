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
      <Field label="Find in document" hint="Search the document you are reading.">
        <ShortcutRecorder
          value={settings.findInDocumentShortcut}
          defaultValue={defaultViewSettings.findInDocumentShortcut}
          onChange={(v) => onChange({ ...settings, findInDocumentShortcut: v })}
        />
      </Field>
      <Field label="Search workspace" hint="Search names, tags and document contents.">
        <ShortcutRecorder
          value={settings.workspaceSearchShortcut}
          defaultValue={defaultViewSettings.workspaceSearchShortcut}
          onChange={(v) => onChange({ ...settings, workspaceSearchShortcut: v })}
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
