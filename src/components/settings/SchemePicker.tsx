import { Check } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { COLOR_SCHEMES, type ColorScheme, type ResolvedScheme } from "@/lib/storage";
import { PICKER_CARD } from "./pickerCard";

const SCHEME_LABELS: Record<ColorScheme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

const TONE_CLASSES: Record<ResolvedScheme, { screen: string; panel: string; line: string }> = {
  light: {
    screen: "bg-scheme-light-screen",
    panel: "bg-scheme-light-panel",
    line: "bg-scheme-light-line",
  },
  dark: {
    screen: "bg-scheme-dark-screen",
    panel: "bg-scheme-dark-panel",
    line: "bg-scheme-dark-line",
  },
};

function Screen({ tone }: { tone: ResolvedScheme }) {
  const { screen, panel, line } = TONE_CLASSES[tone];
  return (
    <span className={cn("flex size-full gap-1 p-1.5", screen)}>
      <span className={cn("w-1/4 shrink-0 rounded-xs", panel)} />
      <span className="flex flex-1 flex-col gap-1 pt-0.5">
        <span className={cn("h-1 w-full rounded-full", line)} />
        <span className={cn("h-1 w-3/4 rounded-full", line)} />
        <span className={cn("h-1 w-1/2 rounded-full", line)} />
      </span>
    </span>
  );
}

function SchemeIllustration({ scheme }: { scheme: ColorScheme }) {
  if (scheme !== "system") return <Screen tone={scheme} />;
  return (
    <span className="relative block size-full">
      <span className="absolute inset-0">
        <Screen tone="light" />
      </span>
      <span className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,0_100%)]">
        <Screen tone="dark" />
      </span>
    </span>
  );
}

// Selection is announced by aria-checked; this is its visual half, a shape
// rather than a tint so it survives a colour-blind reading.
function SelectedMark() {
  return (
    <span
      aria-hidden
      className="absolute right-1 bottom-1 flex size-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
    >
      <Check className="size-2.5" strokeWidth={3} />
    </span>
  );
}

interface Props {
  value: ColorScheme;
  onChange: (next: ColorScheme) => void;
}

export function SchemePicker({ value, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      role="radiogroup"
      aria-label="Color scheme"
      value={value}
      onValueChange={(next) => next && onChange(next as ColorScheme)}
      variant="outline"
      spacing={8}
      className="grid w-full grid-cols-3"
    >
      {COLOR_SCHEMES.map((scheme) => (
        <ToggleGroupItem key={scheme} value={scheme} className={cn(PICKER_CARD, "h-auto p-2")}>
          <span className="relative block h-14 w-full overflow-hidden rounded-sm border">
            <SchemeIllustration scheme={scheme} />
            {scheme === value && <SelectedMark />}
          </span>
          <span className="text-xs font-normal">{SCHEME_LABELS[scheme]}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
