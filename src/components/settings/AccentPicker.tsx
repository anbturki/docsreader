import { Check } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { accentProperties } from "@/hooks/useTheme";
import { ACCENT_COLORS, type AccentColor } from "@/lib/storage";
import { PICKER_CARD } from "./pickerCard";

const ACCENT_LABELS: Record<AccentColor, string> = {
  rose: "Rose",
  orange: "Orange",
  bronze: "Bronze",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  slate: "Slate",
  violet: "Violet",
  magenta: "Magenta",
  black: "Black",
};

interface Props {
  value: AccentColor;
  onChange: (next: AccentColor) => void;
}

export function AccentPicker({ value, onChange }: Props) {
  return (
    <ToggleGroup
      type="single"
      role="radiogroup"
      aria-label="Accent color"
      value={value}
      onValueChange={(next) => next && onChange(next as AccentColor)}
      variant="outline"
      spacing={8}
      className="grid w-full grid-cols-5"
    >
      {ACCENT_COLORS.map((accent) => (
        <ToggleGroupItem key={accent} value={accent} className={cn(PICKER_CARD, "h-auto px-1 py-2")}>
          <span
            aria-hidden
            className="accent-swatch flex size-6 items-center justify-center rounded-full border"
            style={accentProperties(accent)}
          >
            {accent === value && (
              <Check className="size-3.5 text-primary-fixed-foreground" strokeWidth={3} />
            )}
          </span>
          <span className="text-2xs font-normal">{ACCENT_LABELS[accent]}</span>
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
