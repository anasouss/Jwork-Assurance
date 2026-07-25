import { useState, useCallback } from "react";
import { subDays, startOfMonth, subMonths, format } from "date-fns";

export type DatePreset = "7d" | "30d" | "thisMonth" | "3m";

function getPresetRange(preset: DatePreset): { from: Date; to: Date } {
  const today = new Date();
  switch (preset) {
    case "7d":
      return { from: subDays(today, 6), to: today };
    case "30d":
      return { from: subDays(today, 29), to: today };
    case "thisMonth":
      return { from: startOfMonth(today), to: today };
    case "3m":
      return { from: subMonths(today, 3), to: today };
  }
}

export function useDashboardDateRange(defaultPreset: DatePreset = "30d") {
  const initial = getPresetRange(defaultPreset);
  const [from, setFrom] = useState<Date>(initial.from);
  const [to, setTo] = useState<Date>(initial.to);
  const [activePreset, setActivePreset] = useState<DatePreset | null>(
    defaultPreset
  );

  const fromStr = format(from, "yyyy-MM-dd");
  const toStr = format(to, "yyyy-MM-dd");

  const setPreset = useCallback((preset: DatePreset) => {
    const range = getPresetRange(preset);
    setFrom(range.from);
    setTo(range.to);
    setActivePreset(preset);
  }, []);

  const setCustomRange = useCallback((newFrom: Date, newTo: Date) => {
    setFrom(newFrom);
    setTo(newTo);
    setActivePreset(null);
  }, []);

  return {
    from,
    to,
    fromStr,
    toStr,
    activePreset,
    setPreset,
    setCustomRange,
  };
}
