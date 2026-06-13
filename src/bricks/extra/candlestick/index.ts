/**
 * Brick definition for the CandlestickChart — wires the Zod schema to its
 * React component. Server-safe: the component reference is never invoked here.
 */
import { defineBrick } from "@/bricks/types";
import { candlestickSchema } from "./schema";
import { CandlestickChart } from "./component";

export const candlestickBrick = defineBrick({
  name: "CandlestickChart",
  description:
    "A financial OHLC candlestick chart (green up / red down). Bind live OHLC data via bindKey. Use for price/markets.",
  tags: ["chart", "candlestick", "ohlc", "finance", "crypto", "price", "markets", "viz"],
  schema: candlestickSchema,
  acceptsChildren: false,
  Component: CandlestickChart,
});
