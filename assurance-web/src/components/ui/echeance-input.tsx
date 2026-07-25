import * as React from "react";

import { Input } from "@/components/ui/input";

type EcheanceInputProps = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "maxLength"> & {
  value?: string;
  onValueChange?: (value: string | undefined) => void;
};

export function EcheanceInput({ value, onValueChange, onBlur, className, ...props }: EcheanceInputProps) {
  const [textValue, setTextValue] = React.useState(formatEcheanceInput(value ?? ""));
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    setTextValue(formatEcheanceInput(value ?? ""));
  }, [value]);

  const commit = () => {
    if (!textValue.trim()) {
      setError("");
      onValueChange?.(undefined);
      return;
    }
    if (!isValidEcheance(textValue)) {
      setError("Échéance invalide. Format JJ/MM.");
      return;
    }
    setError("");
    onValueChange?.(textValue);
  };

  return (
    <div className="grid gap-1.5">
      <Input
        {...props}
        value={textValue}
        inputMode="numeric"
        maxLength={5}
        placeholder={props.placeholder ?? "JJ/MM"}
        aria-invalid={Boolean(error)}
        className={className}
        onChange={(event) => {
          const next = formatEcheanceInput(event.target.value);
          setTextValue(next);
          setError("");
          onValueChange?.(next || undefined);
        }}
        onBlur={(event) => {
          commit();
          onBlur?.(event);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
          }
        }}
      />
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}

export function isValidEcheance(value?: string) {
  if (!value) {
    return false;
  }
  const match = value.match(/^(\d{2})\/(\d{2})$/);
  if (!match) {
    return false;
  }
  const day = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) {
    return false;
  }
  const maxDay = new Date(2024, month, 0).getDate();
  return day >= 1 && day <= maxDay;
}

function formatEcheanceInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}
