import type { ReactNode } from "react";
import { Cell, LabelList, Legend, Pie, PieChart } from "recharts";
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
  emptyText?: string;
  innerRadius?: number;
  outerRadius?: number;
  showLegend?: boolean;
  showValues?: boolean;
  valueFormatter?: (value: number) => string;
  onSelect?: (key: string) => void;
};

const integerFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const defaultValueFormatter = (value: number) => integerFormatter.format(value);

export function DonutChart({
  data,
  className,
  emptyText = "Aucune donnée disponible.",
  innerRadius = 60,
  outerRadius = 100,
  showLegend = true,
  showValues = true,
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
      <div className={cn("grid h-[300px] place-items-center text-sm text-muted-foreground", className)}>
        {emptyText}
      </div>
    );
  }

  return (
    <ChartContainer config={chartConfig} className={cn("h-[300px] w-full aspect-auto", className)}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          cornerRadius={8}
          paddingAngle={4}
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
          {showValues ? (
            <LabelList
              dataKey="value"
              stroke="none"
              fontSize={12}
              fontWeight={600}
              fill="currentColor"
              formatter={(value) => valueFormatter(Number(value ?? 0))}
            />
          ) : null}
        </Pie>
        {showLegend ? (
          <Legend
            formatter={(value) => chartConfig[value]?.label ?? value}
            wrapperStyle={{ fontSize: 12 }}
          />
        ) : null}
      </PieChart>
    </ChartContainer>
  );
}
