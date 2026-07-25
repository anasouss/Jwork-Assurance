import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { fr } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
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
  placeholder = "Sélectionner une date",
  disabled = false,
  className,
  minDate,
  maxDate,
  occupiedDateRanges,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const dateValue = React.useMemo(() => {
    if (!date) return undefined
    if (date instanceof Date) return date
    return new Date(date)
  }, [date])

  const handleSelect = (selectedDate: Date | undefined) => {
    onSelect?.(selectedDate)
    setOpen(false)
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
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal bg-transparent hover:bg-transparent hover:text-foreground",
            !dateValue && "text-muted-foreground",
            className
          )}
          disabled={disabled}
        >
          <CalendarIcon className="me-2 h-4 w-4" />
          {dateValue ? format(dateValue, "PPP", { locale: fr }) : placeholder}
        </Button>
      </PopoverTrigger>
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
