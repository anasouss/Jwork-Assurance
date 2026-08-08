import type { ReactNode } from "react";
import { Cell, Pie, PieChart } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

export type DonutChartDatum = {
  key: string;
  label: ReactNode;
  value: number;
  color: string;
};

type DonutChartProps = {
  data: DonutChartDatum[];
  className?: string;
  chartClassName?: string;
  emptyText?: string;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showValues?: boolean;
  showCenterValue?: boolean;
  centerLabel?: string;
  valueFormatter?: (value: number) => string;
  onSelect?: (key: string) => void;
};

const integerFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const defaultValueFormatter = (value: number) => integerFormatter.format(value);

export function DonutChart({
  data,
  className,
  chartClassName,
  emptyText = "Aucune donnée disponible.",
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  showValues = true,
  showCenterValue = true,
  centerLabel,
  valueFormatter = defaultValueFormatter,
  onSelect,
}: DonutChartProps) {
  const chartConfig = data.reduce<ChartConfig>((config, item) => {
    config[item.key] = { label: item.label, color: item.color };
    return config;
  }, {});
  const chartData = data.map((item) => ({
    ...item,
    name: item.key,
    fill: item.color,
  }));

  if (!chartData.length) {
    return (
      <div className={cn("grid min-h-60 place-items-center text-sm text-muted-foreground", className)}>
        {emptyText}
      </div>
    );
  }

  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <div
      className={cn(
        "grid min-h-60 items-center gap-4 sm:grid-cols-[160px_minmax(0,1fr)]",
        !showLegend && "grid-cols-1 sm:grid-cols-1",
        className,
      )}
    >
      <div className={cn("relative h-40", chartClassName)}>
        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={3}
              strokeWidth={0}
            >
              {chartData.map((item) => (
                <Cell
                  key={item.key}
                  fill={item.color}
                  className={cn(onSelect && "cursor-pointer")}
                  onClick={() => onSelect?.(item.key)}
                />
              ))}
            </Pie>
            <ChartTooltip
              content={(
                <ChartTooltipContent
                  hideLabel
                  formatter={(value: unknown) => valueFormatter(Number(value ?? 0))}
                />
              )}
            />
          </PieChart>
        </ChartContainer>
        {showCenterValue ? (
          <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
            <span className="text-2xl font-semibold tabular-nums">{valueFormatter(total)}</span>
            {centerLabel ? <span className="text-xs text-muted-foreground">{centerLabel}</span> : null}
          </div>
        ) : null}
      </div>

      {showLegend ? (
        <div className="grid min-w-0 gap-1">
          {chartData.map((item) => {
            const content = (
              <>
                <span className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.label}</span>
                </span>
                {showValues ? (
                  <span className="shrink-0 font-semibold tabular-nums">{valueFormatter(item.value)}</span>
                ) : null}
              </>
            );

            return onSelect ? (
              <button
                key={item.key}
                type="button"
                className="flex min-w-0 items-center justify-between gap-3 border-b py-2 text-left last:border-0 hover:text-primary"
                onClick={() => onSelect(item.key)}
              >
                {content}
              </button>
            ) : (
              <div key={item.key} className="flex min-w-0 items-center justify-between gap-3 border-b py-2 last:border-0">
                {content}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
