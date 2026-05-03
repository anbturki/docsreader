import { Monitor, Moon, Sun } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ACCENT_HUE, type AccentColor, type ColorScheme, type ViewSettings } from "@/lib/storage";

interface Props {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
}

const SCHEMES: { value: ColorScheme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const ACCENTS: { value: AccentColor; label: string }[] = [
  { value: "violet", label: "Violet" },
  { value: "blue", label: "Blue" },
  { value: "green", label: "Green" },
  { value: "orange", label: "Orange" },
  { value: "rose", label: "Rose" },
  { value: "slate", label: "Slate" },
];

const cardClass =
  "h-20 flex-col gap-1 rounded-lg border bg-card text-card-foreground transition-colors " +
  "hover:bg-accent " +
  "data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40 " +
  "data-[state=on]:hover:bg-primary/15";

export function AppearanceSection({ settings, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <Field label="Color scheme" hint="Match your system or pick a fixed mode.">
        <ToggleGroup
          type="single"
          value={settings.colorScheme}
          onValueChange={(v) => v && onChange({ ...settings, colorScheme: v as ColorScheme })}
          variant="outline"
          spacing={8}
          className="grid w-full grid-cols-3"
        >
          {SCHEMES.map(({ value, label, icon: Icon }) => (
            <ToggleGroupItem key={value} value={value} className={cardClass}>
              <Icon className="size-5" />
              <span className="text-xs font-normal">{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field label="Accent color" hint="Used for buttons, links, and highlights.">
        <ToggleGroup
          type="single"
          value={settings.accentColor}
          onValueChange={(v) => v && onChange({ ...settings, accentColor: v as AccentColor })}
          variant="outline"
          spacing={8}
          className="grid w-full grid-cols-3"
        >
          {ACCENTS.map(({ value, label }) => (
            <ToggleGroupItem key={value} value={value} className={cardClass}>
              <span
                aria-hidden
                className="size-6 rounded-full border"
                style={{ background: `oklch(0.6 0.2 ${ACCENT_HUE[value]})` }}
              />
              <span className="text-xs font-normal">{label}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
