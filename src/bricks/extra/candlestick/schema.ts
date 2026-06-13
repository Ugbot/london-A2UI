/**
 * Zod prop schema for the CandlestickChart brick. No "use client" so the agent
 * can import it server-side for validation and embedding.
 */
import { z } from "zod";

export const candlestickSchema = z.object({
  data: z
    .array(
      z.object({
        label: z.string(),
        open: z.number(),
        high: z.number(),
        low: z.number(),
        close: z.number(),
      }),
    )
    .min(1),
  bindKey: z
    .string()
    .optional()
    .describe("Live-bind this brick's OHLC data to a keyed element id, updated via stream actions"),
});

export type CandlestickProps = z.infer<typeof candlestickSchema>;
