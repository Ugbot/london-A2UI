"use client";

/**
 * PriceChart — proper financial graphing (TradingView lightweight-charts v5): candlesticks
 * + an optional volume histogram, crosshair, and a time scale. Imperative API: createChart
 * once on a ref, addSeries(CandlestickSeries/HistogramSeries), setData on change, resize
 * via ResizeObserver.
 */
import * as React from "react";
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  type IChartApi,
  type Time,
  type CandlestickData,
  type HistogramData,
} from "lightweight-charts";
import { useElementData } from "@/state/hooks";
import type { PriceChartProps } from "./schema";

type Live = { data?: PriceChartProps["data"]; volume?: PriceChartProps["volume"] } | PriceChartProps["data"];

export function PriceChart({ data, volume, bindKey, height }: PriceChartProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  const chart = React.useRef<IChartApi | null>(null);
  const candleSeries = React.useRef<ReturnType<IChartApi["addSeries"]> | null>(null);
  const volSeries = React.useRef<ReturnType<IChartApi["addSeries"]> | null>(null);

  const live = useElementData<Live | undefined>(bindKey, undefined);
  const bars = (Array.isArray(live) ? live : live?.data) ?? data;
  const vol = (Array.isArray(live) ? undefined : live?.volume) ?? volume;

  React.useEffect(() => {
    if (!ref.current) return;
    const c = createChart(ref.current, {
      height,
      autoSize: false,
      layout: { background: { color: "transparent" }, textColor: "#64748b" },
      grid: { vertLines: { color: "rgba(100,116,139,0.12)" }, horzLines: { color: "rgba(100,116,139,0.12)" } },
      rightPriceScale: { borderColor: "rgba(100,116,139,0.2)" },
      timeScale: { borderColor: "rgba(100,116,139,0.2)" },
    });
    chart.current = c;
    candleSeries.current = c.addSeries(CandlestickSeries, {
      upColor: "#16a34a",
      downColor: "#dc2626",
      borderVisible: false,
      wickUpColor: "#16a34a",
      wickDownColor: "#dc2626",
    });
    volSeries.current = c.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "vol",
      color: "rgba(99,102,241,0.4)",
    });
    c.priceScale("vol").applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    const ro = new ResizeObserver(() => {
      if (ref.current) c.applyOptions({ width: ref.current.clientWidth, height });
    });
    ro.observe(ref.current);
    c.applyOptions({ width: ref.current.clientWidth, height });
    return () => {
      ro.disconnect();
      c.remove();
      chart.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  React.useEffect(() => {
    candleSeries.current?.setData(bars as unknown as CandlestickData<Time>[]);
    volSeries.current?.setData((vol ?? []) as unknown as HistogramData<Time>[]);
    chart.current?.timeScale().fitContent();
  }, [bars, vol]);

  return <div ref={ref} style={{ width: "100%", height }} />;
}
