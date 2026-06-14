import { z } from "zod";

export const schema = z.object({
  agentName:      z.string().default("GH0ST_R1DER"),
  startCredits:   z.number().default(48320),
  startTrace:     z.number().default(38),
  startProxyHops: z.number().default(4),
});

export type Props = z.infer<typeof schema>;