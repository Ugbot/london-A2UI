import { defineBrick } from "@/bricks/types";
import { timeSeriesSchema } from "./schema";
import { TimeSeries } from "./component";

export const timeSeriesBrick = defineBrick({
  name: "TimeSeries",
  description:
    "A fast time-series line chart (uPlot, Grafana-style) — handles very large datasets (tens of thousands of points) smoothly. Bind { time (unix seconds), series } via bindKey. Use for metrics/monitoring/large time data.",
  tags: ["chart", "timeseries", "metrics", "grafana", "uplot", "monitoring", "line", "viz", "fast"],
  schema: timeSeriesSchema,
  acceptsChildren: false,
  Component: TimeSeries,
});
