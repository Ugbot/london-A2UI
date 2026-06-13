"use client";

/**
 * Scatter plot brick. Renders x/y points via recharts, following the chart
 * conventions in components.tsx (ResponsiveContainer in an h-64 frame, grid +
 * axes styled from theme vars). Supports live data binding via `bindKey`.
 */
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart as RScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useElementData } from "@/state/hooks";
import type { ScatterChartProps } from "./schema";

export function ScatterChart(props: ScatterChartProps) {
  const { color, xLabel, yLabel, bindKey } = props;
  const live = useElementData<ScatterChartProps["data"] | undefined>(bindKey, undefined);
  const data = live ?? props.data;
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RScatterChart>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="x"
            type="number"
            name={xLabel}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <YAxis
            dataKey="y"
            type="number"
            name={yLabel}
            fontSize={12}
            stroke="var(--muted-foreground)"
          />
          <Tooltip cursor={{ strokeDasharray: "3 3" }} />
          <Scatter data={data} fill={color} />
        </RScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
