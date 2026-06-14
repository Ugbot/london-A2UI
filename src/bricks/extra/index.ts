/**
 * Barrel of "extra" bricks (each self-contained in its own folder). Kept
 * separate from the core defs so new bricks can be added without touching
 * shared files. Spread into the registry by defs.ts.
 */
import type { BrickDef } from "@/bricks/types";
import { candlestickBrick } from "./candlestick";
import { areaChartBrick } from "./area";
import { gaugeBrick } from "./gauge";
import { scatterChartBrick } from "./scatter";
import { heatmapBrick } from "./heatmap";
import { flowchartBrick } from "./flowchart";
import { masterDetailBrick } from "./master-detail";
import { forceGraphBrick } from "./force-graph";
import { echartBrick, radarBrick, sankeyBrick, treemapBrick, funnelBrick } from "./echarts";
import { dataGridBrick } from "./data-grid";
import { priceChartBrick } from "./price-chart";
import { timeSeriesBrick } from "./time-series";

export const EXTRA_BRICKS: BrickDef[] = [
  candlestickBrick,
  areaChartBrick,
  gaugeBrick,
  scatterChartBrick,
  heatmapBrick,
  flowchartBrick,
  masterDetailBrick,
  forceGraphBrick,
  // High-powered ECharts charts (Superset/Metabase-grade)
  echartBrick,
  radarBrick,
  sankeyBrick,
  treemapBrick,
  funnelBrick,
  // ag-Grid data grid, TradingView financial, uPlot fast time-series
  dataGridBrick,
  priceChartBrick,
  timeSeriesBrick,
];
