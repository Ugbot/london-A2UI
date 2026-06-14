import { z } from "zod";
import { defineContract } from "@/bricks/contract";

export const schema = z.object({
  bindKey: z.string().optional().describe("Keyed element providing the value to display"),
  value: z.unknown().optional().describe("Static fallback value"),
  agentName:      z.string().default('GH0ST_R1DER'),
  startCredits:   z.number().default(48320),
  startTrace:     z.number().default(38),
  startProxyHops: z.number().default(4),
});
export type Props = z.infer<typeof schema>;

export const contract = defineContract({ commands: {}, events: {} });
