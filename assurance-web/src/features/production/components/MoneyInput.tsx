import { useEffect, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { numberValue } from "../utils/format";

type MoneyInputProps = Omit<ComponentProps<typeof Input>, "type" | "value" | "onChange" | "inputMode"> & {
  value?: number | null;
  onValueChange: (value: number | undefined) => void;
};

export function MoneyInput({ value, onValueChange, onBlur, onFocus, ...props }: MoneyInputProps) {
  const [focused, setFocused] = useState(false);
  const [display, setDisplay] = useState(() => formatAmount(value));

  useEffect(() => {
    if (!focused) {
      setDisplay(formatAmount(value));
    }
  }, [focused, value]);

  return (
    <Input
      {...props}
      inputMode="decimal"
      type="text"
      value={display}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        setDisplay(formatAmount(numberValue(event.target.value)));
        onBlur?.(event);
      }}
      onChange={(event) => {
        const nextDisplay = formatEditableAmount(event.target.value);
        setDisplay(nextDisplay);
        onValueChange(numberValue(nextDisplay));
      }}
    />
  );
}

function formatAmount(value?: number | null) {
  if (value == null || !Number.isFinite(Number(value))) {
    return "";
  }
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function formatEditableAmount(value: string) {
  const compact = value.replace(/\s/g, "").replace(/[^\d,.]/g, "");
  if (!compact) {
    return "";
  }
  const separatorIndex = compact.search(/[,.]/);
  const hasDecimal = separatorIndex >= 0;
  const integerPart = hasDecimal ? compact.slice(0, separatorIndex) : compact;
  const decimalPart = hasDecimal ? compact.slice(separatorIndex + 1).replace(/[,.]/g, "") : "";
  const separator = hasDecimal ? compact[separatorIndex] : "";
  const groupedInteger = groupThousands(integerPart);
  return hasDecimal ? `${groupedInteger}${separator}${decimalPart}` : groupedInteger;
}

function groupThousands(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
