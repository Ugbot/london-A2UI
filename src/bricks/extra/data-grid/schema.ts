import { z } from "zod";

export const dataGridSchema = z.object({
  columns: z
    .array(z.object({ field: z.string(), headerName: z.string().optional() }))
    .default([])
    .describe("Column definitions; if empty, inferred from the first row's keys"),
  rows: z.array(z.record(z.unknown())).default([]),
  bindKey: z.string().optional().describe("Keyed data element providing the row array"),
  height: z.number().int().min(120).max(1600).default(380),
  pagination: z.boolean().default(true),
});
export type DataGridProps = z.infer<typeof dataGridSchema>;
