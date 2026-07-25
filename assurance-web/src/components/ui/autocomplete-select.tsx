import * as React from "react";
import { Check, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export type AutocompleteOption = {
  value: string;
  label: string;
  keywords?: string | null;
};

type AutocompleteSelectProps = {
  options: AutocompleteOption[];
  value?: string;
  onValueChange: (value: string) => void;
  customValue?: string;
  onCustomValueChange?: (value: string | undefined) => void;
  allowCustomValue?: boolean;
  placeholder?: string;
  emptyText?: string;
  invalidText?: string;
  disabled?: boolean;
  className?: string;
};

export function AutocompleteSelect({
  options,
  value,
  onValueChange,
  customValue,
  onCustomValueChange,
  allowCustomValue = false,
  placeholder = "Choisir",
  emptyText = "Aucun résultat",
  invalidText = "Choisissez une option existante.",
  disabled = false,
  className,
}: AutocompleteSelectProps) {
  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? customValue ?? "";
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(selectedLabel);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [invalid, setInvalid] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setQuery(selectedLabel);
    }
  }, [open, selectedLabel]);

  const filtered = React.useMemo(() => {
    const normalized = normalize(query);
    if (!normalized) {
      return options.slice(0, 80);
    }
    return options
      .filter((option) => normalize(`${option.label} ${option.keywords ?? ""}`).includes(normalized))
      .slice(0, 80);
  }, [options, query]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectOption = (option: AutocompleteOption) => {
    onValueChange(option.value);
    setQuery(option.label);
    setInvalid(false);
    setOpen(false);
  };

  const commitQuery = () => {
    const trimmed = query.trim();
    if (!trimmed) {
      onValueChange("");
      onCustomValueChange?.(undefined);
      setInvalid(false);
      return;
    }

    const exact = options.find((option) => normalize(option.label) === normalize(trimmed));
    if (exact) {
      selectOption(exact);
      return;
    }

    if (allowCustomValue) {
      onValueChange("");
      onCustomValueChange?.(trimmed);
      setQuery(trimmed);
      setInvalid(false);
      return;
    }

    onValueChange("");
    onCustomValueChange?.(undefined);
    setQuery(trimmed);
    setInvalid(true);
  };

  return (
    <div className={cn("relative grid gap-1.5", className)}>
      <Input
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setInvalid(false);
          onValueChange("");
          onCustomValueChange?.(allowCustomValue && event.target.value ? event.target.value : undefined);
        }}
        onBlur={() => {
          window.setTimeout(() => {
            commitQuery();
            setOpen(false);
          }, 120);
        }}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "Enter")) {
            setOpen(true);
            return;
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((current) => Math.max(current - 1, 0));
          }
          if (event.key === "Enter" && filtered[activeIndex]) {
            event.preventDefault();
            selectOption(filtered[activeIndex]);
          }
          if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={cn("pr-9", invalid && "border-red-500 ring-1 ring-red-500/20")}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      {open && !disabled ? (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
          ) : (
            filtered.map((option, index) => {
              const active = index === activeIndex;
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none",
                    active ? "bg-accent text-accent-foreground" : "hover:bg-accent hover:text-accent-foreground"
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <Check className={cn("size-4", selected ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
      {invalid ? <span className="text-xs text-red-600">{invalidText}</span> : null}
    </div>
  );
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
