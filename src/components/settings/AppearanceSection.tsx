import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DARK_CODE_THEMES,
  LIGHT_CODE_THEMES,
  type DarkCodeTheme,
  type LightCodeTheme,
  type ViewSettings,
} from "@/lib/storage";
import { AccentPicker } from "./AccentPicker";
import { SchemePicker } from "./SchemePicker";

interface Props {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
}

interface CodeThemePreview {
  bg: string;
  fg: string;
  accent: string;
}

const LIGHT_PREVIEWS: Record<LightCodeTheme, CodeThemePreview> = {
  "github-light": { bg: "#ffffff", fg: "#24292e", accent: "#d73a49" },
  "vitesse-light": { bg: "#ffffff", fg: "#393a34", accent: "#ab5959" },
  "one-light": { bg: "#fafafa", fg: "#383a42", accent: "#a626a4" },
  "min-light": { bg: "#ffffff", fg: "#24292eff", accent: "#1976d2" },
  "light-plus": { bg: "#ffffff", fg: "#000000", accent: "#0000ff" },
};

const DARK_PREVIEWS: Record<DarkCodeTheme, CodeThemePreview> = {
  "github-dark": { bg: "#24292e", fg: "#e1e4e8", accent: "#f97583" },
  "vitesse-dark": { bg: "#121212", fg: "#dbd7caee", accent: "#cb7676" },
  dracula: { bg: "#282a36", fg: "#f8f8f2", accent: "#ff79c6" },
  "one-dark-pro": { bg: "#282c34", fg: "#abb2bf", accent: "#c678dd" },
  monokai: { bg: "#272822", fg: "#f8f8f2", accent: "#f92672" },
  "tokyo-night": { bg: "#1a1b26", fg: "#a9b1d6", accent: "#bb9af7" },
  nord: { bg: "#2e3440", fg: "#d8dee9", accent: "#88c0d0" },
};

export function AppearanceSection({ settings, onChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <Field label="Color scheme" hint="Match your system or pick a fixed mode.">
        <SchemePicker
          value={settings.colorScheme}
          onChange={(colorScheme) => onChange({ ...settings, colorScheme })}
        />
      </Field>

      <Field label="Accent color" hint="Used for buttons, links, and highlights.">
        <AccentPicker
          value={settings.accentColor}
          onChange={(accentColor) => onChange({ ...settings, accentColor })}
        />
      </Field>

      <Field label="Code block theme" hint="Syntax-highlighting theme used for fenced code.">
        <div className="grid grid-cols-2 gap-3">
          <CodeThemeSelect
            label="Light mode"
            value={settings.codeThemeLight}
            options={LIGHT_CODE_THEMES}
            previews={LIGHT_PREVIEWS}
            onChange={(v) => onChange({ ...settings, codeThemeLight: v })}
          />
          <CodeThemeSelect
            label="Dark mode"
            value={settings.codeThemeDark}
            options={DARK_CODE_THEMES}
            previews={DARK_PREVIEWS}
            onChange={(v) => onChange({ ...settings, codeThemeDark: v })}
          />
        </div>
      </Field>
    </div>
  );
}

interface CodeThemeSelectProps<T extends string> {
  label: string;
  value: T;
  options: readonly T[];
  previews: Record<T, CodeThemePreview>;
  onChange: (next: T) => void;
}

function CodeThemeSelect<T extends string>({
  label,
  value,
  options,
  previews,
  onChange,
}: CodeThemeSelectProps<T>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger className="w-full">
          <SelectValue>
            <ThemePreviewRow theme={value} preview={previews[value]} />
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={opt}>
              <ThemePreviewRow theme={opt} preview={previews[opt]} />
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ThemePreviewRow({
  theme,
  preview,
}: {
  theme: string;
  preview: CodeThemePreview;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="flex size-5 shrink-0 items-center justify-center rounded border"
        style={{ background: preview.bg }}
      >
        <span className="size-1.5 rounded-full" style={{ background: preview.accent }} />
      </span>
      <span className="truncate">{theme}</span>
    </span>
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
