import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

type OccupiedDateRange = {
  startDate: Date | string
  endDate: Date | string
}

interface DatePickerProps {
  date?: Date | string
  onSelect?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  minDate?: Date
  maxDate?: Date
  occupiedDateRanges?: OccupiedDateRange[]
}

export function DatePicker({
  date,
  onSelect,
  disabled = false,
  className,
  minDate,
  maxDate,
  occupiedDateRanges,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [textValue, setTextValue] = React.useState("")
  const [typedError, setTypedError] = React.useState("")

  const dateValue = React.useMemo(() => {
    if (!date) return undefined
    if (date instanceof Date) return date
    return parseIsoDate(date)
  }, [date])

  React.useEffect(() => {
    setTextValue(dateValue ? format(dateValue, "dd/MM/yyyy") : "")
  }, [dateValue])

  const handleSelect = (selectedDate: Date | undefined) => {
    setTypedError("")
    onSelect?.(selectedDate)
    setOpen(false)
  }

  const commitTypedDate = () => {
    if (!textValue.trim()) {
      setTypedError("")
      onSelect?.(undefined)
      return
    }
    const parsed = parseTypedDate(textValue)
    if (parsed) {
      if ((minDate && parsed < minDate) || (maxDate && parsed > maxDate) || isDateOccupied(parsed)) {
        setTypedError("Date hors période autorisée.")
        return
      }
      setTypedError("")
      onSelect?.(parsed)
      setTextValue(format(parsed, "dd/MM/yyyy"))
      return
    }
    setTypedError("Date invalide. Format JJ/MM/AAAA.")
  }

  const isDateOccupied = React.useCallback(
    (checkDate: Date) => {
      if (!occupiedDateRanges || occupiedDateRanges.length === 0) return false

      const normalizedCheckDate = new Date(checkDate)
      normalizedCheckDate.setHours(0, 0, 0, 0)

      return occupiedDateRanges.some((range) => {
        const rangeStart = new Date(range.startDate)
        const rangeEnd = new Date(range.endDate)

        rangeStart.setHours(0, 0, 0, 0)
        rangeEnd.setHours(0, 0, 0, 0)

        return normalizedCheckDate >= rangeStart && normalizedCheckDate <= rangeEnd
      })
    },
    [occupiedDateRanges]
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="grid gap-1.5">
        <div className={cn("flex w-full overflow-hidden rounded-md", className)}>
          <Input
            value={textValue}
            disabled={disabled}
            placeholder="JJ/MM/AAAA"
            inputMode="numeric"
            maxLength={10}
            onChange={(event) => {
              setTypedError("")
              setTextValue(formatDateInput(event.target.value))
              onSelect?.(undefined)
            }}
            onBlur={commitTypedDate}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur()
              }
            }}
            className={cn("rounded-r-none border-r-0 shadow-none", typedError && "border-red-500 ring-1 ring-red-500/20")}
          />
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              data-slot="date-trigger"
              className={cn(
                "h-9 rounded-l-none border-slate-300 bg-slate-50/70 px-3 shadow-none hover:bg-slate-50 hover:text-foreground disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-100 dark:border-neutral-700 dark:bg-neutral-950/70 dark:text-neutral-100 dark:hover:bg-neutral-900 dark:disabled:border-neutral-800 dark:disabled:bg-neutral-950 dark:disabled:text-neutral-500",
                typedError && "border-red-500"
              )}
              disabled={disabled}
              aria-label="Choisir une date"
            >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </div>
        {typedError ? <span className="text-xs text-red-600">{typedError}</span> : null}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          required={false}
          buttonVariant="outline"
          selected={dateValue}
          onSelect={handleSelect}
          defaultMonth={dateValue}
          captionLayout="dropdown"
          fromYear={1900}
          toYear={2100}
          disabled={(calendarDate) => {
            if (minDate && calendarDate < minDate) return true
            if (maxDate && calendarDate > maxDate) return true
            if (isDateOccupied(calendarDate)) return true
            return false
          }}
          modifiers={{
            occupied: (calendarDate) => isDateOccupied(calendarDate),
          }}
          modifiersClassNames={{
            occupied:
              "line-through text-red-500 opacity-40 relative after:content-[''] after:absolute after:left-0 after:right-0 after:top-1/2 after:h-[2px] after:bg-red-500",
          }}
          initialFocus
          locale={fr}
        />
      </PopoverContent>
    </Popover>
  )
}

function parseTypedDate(value: string) {
  const normalized = value.trim()
  const slash = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  const parts = slash ? { day: Number(slash[1]), month: Number(slash[2]), year: Number(slash[3]) } : null
  if (!parts) return undefined
  if (parts.year < 1900 || parts.year > 2100) return undefined
  const parsed = new Date(parts.year, parts.month - 1, parts.day)
  if (
    parsed.getFullYear() !== parts.year ||
    parsed.getMonth() !== parts.month - 1 ||
    parsed.getDate() !== parts.day
  ) {
    return undefined
  }
  return parsed
}

function formatDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function parseIsoDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return new Date(value)
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}
