import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { ContentWidth, FontFamily, FontSize, ViewSettings } from "@/lib/storage";

interface Props {
  settings: ViewSettings;
  onChange: (next: ViewSettings) => void;
}

const cardClass =
  "h-20 flex-col gap-1 rounded-lg border bg-card text-card-foreground transition-colors " +
  "hover:bg-accent " +
  "data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40 " +
  "data-[state=on]:hover:bg-primary/15";

const pillClass =
  "h-11 rounded-lg border bg-card text-card-foreground transition-colors text-sm font-medium " +
  "hover:bg-accent " +
  "data-[state=on]:bg-primary/10 data-[state=on]:text-primary data-[state=on]:border-primary/40 " +
  "data-[state=on]:hover:bg-primary/15";

export function ReadingSection({ settings, onChange }: Props) {
  return (
    <div className="flex flex-col gap-6">
      <Field label="Font family" hint="Used for the rendered article body.">
        <ToggleGroup
          type="single"
          value={settings.fontFamily}
          onValueChange={(v) => v && onChange({ ...settings, fontFamily: v as FontFamily })}
          variant="outline"
          spacing={8}
          className="grid w-full grid-cols-3"
        >
          <FontCard value="sans" preview="Aa" label="System" previewClass="font-sans" />
          <FontCard value="serif" preview="Ss" label="Serif" previewClass="font-serif" />
          <FontCard value="mono" preview="00" label="Mono" previewClass="font-mono" />
        </ToggleGroup>
      </Field>

      <Field label="Font size">
        <ToggleGroup
          type="single"
          value={settings.fontSize}
          onValueChange={(v) => v && onChange({ ...settings, fontSize: v as FontSize })}
          variant="outline"
          spacing={8}
          className="grid w-full grid-cols-3"
        >
          <SizeCard value="sm" label="Small" sampleClass="text-base" />
          <SizeCard value="md" label="Default" sampleClass="text-xl" />
          <SizeCard value="lg" label="Large" sampleClass="text-2xl" />
        </ToggleGroup>
      </Field>

      <Field label="Page width" hint="Constrain reading width or use the full window.">
        <ToggleGroup
          type="single"
          value={settings.width}
          onValueChange={(v) => v && onChange({ ...settings, width: v as ContentWidth })}
          variant="outline"
          spacing={8}
          className="grid w-full grid-cols-2"
        >
          <ToggleGroupItem value="narrow" className={pillClass}>
            Default
          </ToggleGroupItem>
          <ToggleGroupItem value="full" className={pillClass}>
            Full width
          </ToggleGroupItem>
        </ToggleGroup>
      </Field>
    </div>
  );
}

function FontCard({
  value,
  preview,
  label,
  previewClass,
}: {
  value: string;
  preview: string;
  label: string;
  previewClass?: string;
}) {
  return (
    <ToggleGroupItem value={value} className={cardClass}>
      <span className={`text-2xl leading-none ${previewClass ?? ""}`}>{preview}</span>
      <span className="text-xs font-normal">{label}</span>
    </ToggleGroupItem>
  );
}

function SizeCard({
  value,
  label,
  sampleClass,
}: {
  value: string;
  label: string;
  sampleClass: string;
}) {
  return (
    <ToggleGroupItem value={value} className={cardClass}>
      <div className="flex items-center gap-1.5 leading-none">
        <span className={`${sampleClass} font-semibold`}>Aa</span>
        <div className="flex flex-col gap-0.5">
          <span className="block h-px w-5 bg-current opacity-60" />
          <span className="block h-px w-5 bg-current opacity-60" />
          <span className="block h-px w-3 bg-current opacity-60" />
        </div>
      </div>
      <span className="text-xs font-normal">{label}</span>
    </ToggleGroupItem>
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
