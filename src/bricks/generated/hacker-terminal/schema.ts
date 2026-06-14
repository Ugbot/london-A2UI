import { z } from "zod";
import { defineContract } from "@/bricks/contract";

export const schema = z.object({
  bindKey: z.string().optional().describe("Keyed element providing the value to display"),
  value: z.unknown().optional().describe("Static fallback value"),
  title: z.string().default('UPLINK OS v4.2.1'),
  username: z.string().default('GH0ST_R1DER'),
  prompt: z.string().default('root@uplink:~$'),
  initialLog: z.array(z.string()).default([
    'UPLINK OS v4.2.1 — Internic Global Network',
    'Connection established via proxy chain: [TOR] → [NL-NODE] → [UPLINK]',
    'Welcome back, GH0ST_R1DER. You have 3 new mission briefs.',
    'Type \'help\' for available commands.',
    ''
  ]),
});
export type Props = z.infer<typeof schema>;

export const contract = defineContract({ commands: {}, events: {} });
