"use client";

/**
 * Filled area chart built on recharts. Props are validated against `areaSchema`
 * before render, so this component trusts its inputs. Supports live data via
 * `bindKey`, falling back to the static `data` prop.
 */
import * as React from "react";
import {
  Area,
  AreaChart as RAreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useElementData } from "@/state/hooks";
import type { AreaChartProps } from "./schema";

export function AreaChart({ data, color, bindKey }: AreaChartProps) {
  const live = useElementData<AreaChartProps["data"] | undefined>(bindKey, undefined);
  const chartData = live ?? data;
  const gradientId = React.useId();

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={chartData}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.4} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" fontSize={12} stroke="var(--muted-foreground)" />
          <YAxis fontSize={12} stroke="var(--muted-foreground)" />
          <Tooltip />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
          />
        </RAreaChart>
      </ResponsiveContainer>
    </div>
  );
}
