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
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  className?: string;
};

export function AutocompleteSelect({
  options,
  value,
  onValueChange,
  placeholder = "Choisir",
  emptyText = "Aucun résultat",
  disabled = false,
  className,
}: AutocompleteSelectProps) {
  const selectedOption = options.find((option) => option.value === value);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState(selectedOption?.label ?? "");
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    if (!open) {
      setQuery(selectedOption?.label ?? "");
    }
  }, [open, selectedOption?.label]);

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
    setOpen(false);
  };

  return (
    <div className={cn("relative", className)}>
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
          if (!event.target.value) {
            onValueChange("");
          }
        }}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
            setQuery(selectedOption?.label ?? "");
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
        className="pr-9"
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
