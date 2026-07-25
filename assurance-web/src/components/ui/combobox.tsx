import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string | number
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string | number
  onValueChange: (value: string | number) => void
  placeholder?: string
  emptyText?: string
  searchPlaceholder?: string
  className?: string
  disabled?: boolean
  isLoading?: boolean
  onSearchChange?: (search: string) => void
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select an option...",
  emptyText = "No option found.",
  searchPlaceholder = "Search...",
  className,
  disabled = false,
  isLoading = false,
  onSearchChange,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  const handleSearchChange = (search: string) => {
    setSearchValue(search)
    if (onSearchChange) {
      onSearchChange(search)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-transparent hover:bg-transparent hover:text-foreground shadow-none",
            className
          )}
          disabled={disabled}
        >
          {selectedOption ? selectedOption.label : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 z-[1000]"
        align="start"
        sideOffset={4}
      >
        <Command shouldFilter={!onSearchChange}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={handleSearchChange}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? "Recherche en cours..." : emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onValueChange(option.value === value ? "" : option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
