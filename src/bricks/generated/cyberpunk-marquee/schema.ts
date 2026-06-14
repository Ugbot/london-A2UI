import { z } from "zod";
import { defineContract } from "@/bricks/contract";

export const schema = z.object({
  bindKey: z.string().optional().describe("Keyed element providing the value to display"),
  value: z.unknown().optional().describe("Static fallback value"),
  handle: z.string().default('GH0ST_R1DER'),
  items: z.array(z.string()).default([
    '⬡ AGENT: GH0ST_R1DER',
    '◈ STATUS: ACTIVE',
    '⚡ RANK: ELITE #47',
    '⚠ TRACE: 38%',
    '◉ PROXY: 4 HOPS',
    '▶ MISSION: 4 ACTIVE',
    '✦ CLEARANCE: BLACK',
    '⬡ ID: [ENCRYPTED]',
  ]),
  color: z.string().default('#a855f7'),
  glowColor: z.string().default('#7c3aed'),
});
export type Props = z.infer<typeof schema>;

export const contract = defineContract({ commands: {}, events: {} });
