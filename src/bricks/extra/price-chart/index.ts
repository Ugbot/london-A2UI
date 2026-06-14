import { defineBrick } from "@/bricks/types";
import { priceChartSchema } from "./schema";
import { PriceChart } from "./component";

export const priceChartBrick = defineBrick({
  name: "PriceChart",
  description:
    "Professional financial chart (TradingView lightweight-charts) — candlesticks + volume + crosshair + time axis. Bind live OHLC data ({data, volume}) via bindKey. Use for markets/crypto/stocks; richer than CandlestickChart.",
  tags: ["chart", "finance", "candlestick", "ohlc", "price", "markets", "crypto", "stocks", "trading", "viz"],
  schema: priceChartSchema,
  acceptsChildren: false,
  Component: PriceChart,
});
