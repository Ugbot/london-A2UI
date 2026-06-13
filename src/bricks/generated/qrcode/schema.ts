import { z } from "zod";
export const schema = z.object({ value: z.string().default("https://example.com"), size: z.number().int().min(64).max(512).default(160) });
export type Props = z.infer<typeof schema>;
