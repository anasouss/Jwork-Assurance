import * as React from "react";
import { Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type TimePickerProps = {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
};

const HOURS = Array.from({ length: 24 }, (_, index) =>
  String(index).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

export function TimePicker({
  value = "",
  onChange,
  disabled = false,
  className,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false);
  const [textValue, setTextValue] = React.useState(value);
  const [invalid, setInvalid] = React.useState(false);
  const parsed = parseTime(value);

  React.useEffect(() => {
    setTextValue(value);
    setInvalid(false);
  }, [value]);

  const commit = () => {
    if (!textValue) {
      setInvalid(false);
      onChange?.("");
      return;
    }
    const time = parseTime(textValue);
    if (!time) {
      setInvalid(true);
      return;
    }
    const normalized = `${time.hour}:${time.minute}`;
    setTextValue(normalized);
    setInvalid(false);
    onChange?.(normalized);
  };

  const selectPart = (part: "hour" | "minute", selected: string) => {
    const next = {
      hour: parsed?.hour ?? "00",
      minute: parsed?.minute ?? "00",
      [part]: selected,
    };
    const normalized = `${next.hour}:${next.minute}`;
    setTextValue(normalized);
    setInvalid(false);
    onChange?.(normalized);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className={cn("grid gap-1.5", className)}>
        <div className="flex w-full overflow-hidden rounded-md">
          <Input
            value={textValue}
            disabled={disabled}
            inputMode="numeric"
            maxLength={5}
            placeholder="HH:MM"
            aria-invalid={invalid}
            onChange={(event) => {
              setInvalid(false);
              setTextValue(formatTimeInput(event.target.value));
            }}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            className={cn(
              "rounded-r-none border-r-0 shadow-none",
              invalid && "border-red-500 ring-1 ring-red-500/20",
            )}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              aria-label="Choisir une heure"
              className={cn(
                "h-9 rounded-l-none border-slate-300 bg-slate-50/70 px-3 shadow-none hover:bg-slate-50 hover:text-foreground dark:border-neutral-700 dark:bg-neutral-950/70 dark:text-neutral-100 dark:hover:bg-neutral-900",
                invalid && "border-red-500",
              )}
            >
              <Clock3 className="size-4" />
            </Button>
          </PopoverTrigger>
        </div>
        {invalid ? (
          <span className="text-xs text-red-600">Heure invalide. Format HH:MM.</span>
        ) : null}
      </div>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <Select
            value={parsed?.hour ?? "00"}
            onValueChange={(selected) => selectPart("hour", selected)}
          >
            <SelectTrigger aria-label="Heures">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HOURS.map((hour) => (
                <SelectItem key={hour} value={hour}>
                  {hour}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="font-semibold">:</span>
          <Select
            value={parsed?.minute ?? "00"}
            onValueChange={(selected) => selectPart("minute", selected)}
          >
            <SelectTrigger aria-label="Minutes">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MINUTES.map((minute) => (
                <SelectItem key={minute} value={minute}>
                  {minute}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function parseTime(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? { hour: match[1], minute: match[2] } : undefined;
}

function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}
