import { z } from "zod";

export const masterDetailSchema = z.object({
  title: z.string().optional(),
  /**
   * The master list. One CHILD composition node per item, in order, is the
   * detail view shown when that item is selected (mini master-detail SPA).
   */
  items: z
    .array(z.object({ label: z.string(), subtitle: z.string().optional() }))
    .min(1),
});

export type MasterDetailProps = z.infer<typeof masterDetailSchema>;
