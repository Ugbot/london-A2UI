"use client";

/**
 * Shared Apache ECharts host (the Superset/Metabase powerhouse). ECharts is imperative
 * — init once on a ref'd div, setOption on change, resize via ResizeObserver, dispose on
 * unmount (the same pattern as the d3 force-graph brick). All ECharts-backed bricks
 * (raw EChart + Radar/Sankey/Treemap/Funnel) render through this.
 */
import * as React from "react";
import * as echarts from "echarts";

/** Brand palette so charts match the app accent by default. */
export const ECHART_PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6"];

export function EChartBox({
  option,
  height = 300,
  className,
}: {
  option: echarts.EChartsCoreOption | null;
  height?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const chart = React.useRef<echarts.ECharts | null>(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const instance = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chart.current = instance;
    const ro = new ResizeObserver(() => instance.resize());
    ro.observe(ref.current);
    return () => {
      ro.disconnect();
      instance.dispose();
      chart.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (chart.current && option) chart.current.setOption({ color: ECHART_PALETTE, ...option }, true);
  }, [option]);

  return <div ref={ref} className={className} style={{ width: "100%", height }} />;
}
