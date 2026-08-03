import Color from "color";
import { useCallback, type ComponentProps } from "react";
import {
  ColorPicker,
  ColorPickerEyeDropper,
  ColorPickerFormat,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from "@/components/kibo-ui/color-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ColorPickerFieldProps = {
  value?: string;
  onChange: (value: string) => void;
  defaultValue?: string;
  disabled?: boolean;
  className?: string;
};

type PickerChangeValue = Parameters<ComponentProps<typeof ColorPicker>["onChange"]>[0];

export function ColorPickerField({
  value = "",
  onChange,
  defaultValue = "#059669",
  disabled = false,
  className,
}: ColorPickerFieldProps) {
  const pickerValue = validColor(value) ? value : defaultValue;
  const handlePickerChange = useCallback((nextValue: PickerChangeValue) => {
    const nextHex = Color.rgb(nextValue).hex().toUpperCase();
    if (nextHex.toLowerCase() !== pickerValue.toLowerCase()) onChange(nextHex);
  }, [onChange, pickerValue]);

  return (
    <div className={cn("flex gap-2", className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={disabled}
            aria-label="Choisir une couleur"
            className="shrink-0"
          >
            <span
              className="size-5 rounded-sm border border-black/10"
              style={{ backgroundColor: pickerValue }}
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="start">
          <ColorPicker value={pickerValue} onChange={handlePickerChange}>
            <ColorPickerSelection className="h-40" />
            <ColorPickerHue />
            <div className="flex items-center gap-2">
              <ColorPickerEyeDropper />
              <ColorPickerOutput />
              <ColorPickerFormat className="min-w-0 flex-1" />
            </div>
          </ColorPicker>
        </PopoverContent>
      </Popover>
      <Input
        value={value}
        disabled={disabled}
        placeholder={defaultValue}
        maxLength={9}
        spellCheck={false}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function validColor(value: string) {
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value);
}
