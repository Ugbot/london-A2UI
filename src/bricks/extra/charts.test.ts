import { describe, it, expect } from "vitest";
import { getBrick, registry } from "@/bricks/registry";
import { validateComposition } from "@/bricks/composition";

const NEW_CHARTS = [
  "EChart",
  "RadarChart",
  "SankeyChart",
  "TreemapChart",
  "FunnelChart",
  "DataGrid",
  "PriceChart",
  "TimeSeries",
];

describe("high-powered chart bricks (ECharts / ag-Grid / lightweight-charts / uPlot)", () => {
  it("all register in the brick registry", () => {
    for (const name of NEW_CHARTS) {
      expect(getBrick(name), `${name} registered`).toBeTruthy();
    }
  });

  it("each validates inside a composition with minimal props (schema defaults fill in)", () => {
    const tree = {
      brick: "Stack",
      props: { gap: 4 },
      children: NEW_CHARTS.map((brick) => ({ brick, props: {} })),
    };
    const result = validateComposition(tree, registry);
    expect(result.ok, result.ok ? "" : JSON.stringify((result as { errors: unknown }).errors)).toBe(true);
  });

  it("validates representative bound props (PriceChart OHLC, DataGrid rows, EChart option)", () => {
    const ok = (brick: string, props: Record<string, unknown>) =>
      validateComposition({ brick: "Stack", props: {}, children: [{ brick, props }] }, registry).ok;
    expect(ok("PriceChart", { data: [{ time: "2024-01-01", open: 1, high: 2, low: 0.5, close: 1.5 }] })).toBe(true);
    expect(ok("DataGrid", { rows: [{ a: 1, b: "x" }], pagination: true })).toBe(true);
    expect(ok("EChart", { option: { series: [{ type: "bar", data: [1, 2, 3] }] } })).toBe(true);
    expect(ok("TimeSeries", { time: [1, 2, 3], series: [{ name: "cpu", data: [10, 20, 15] }] })).toBe(true);
    expect(ok("SankeyChart", { nodes: [{ name: "A" }, { name: "B" }], links: [{ source: "A", target: "B", value: 5 }] })).toBe(true);
  });
});
