import { z } from "zod";
import { defineContract } from "@/bricks/contract";

export const schema = z.object({
  bindKey: z.string().optional().describe("Keyed element providing the value to display"),
  value: z.unknown().optional().describe("Static fallback value"),
  nodes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    x: z.number(),
    y: z.number(),
    type: z.enum(['hub','target','proxy','secure','pwned']).default('hub'),
  })).default([
    { id: 'home', label: 'HOME BASE', x: 50, y: 50, type: 'hub' },
    { id: 'tor1', label: 'TOR NODE\nAmsterdam', x: 22, y: 30, type: 'proxy' },
    { id: 'arc', label: 'ARC CORP', x: 75, y: 22, type: 'target' },
    { id: 'neura', label: 'NEURATECH', x: 80, y: 65, type: 'secure' },
    { id: 'aeon', label: 'AEON SYS', x: 55, y: 80, type: 'target' },
    { id: 'pwn1', label: 'COMPROMISED\nSERVER', x: 30, y: 68, type: 'pwned' },
  ]),
  links: z.array(z.object({ source: z.string(), target: z.string() })).default([
    { source: 'home', target: 'tor1' },
    { source: 'home', target: 'arc' },
    { source: 'home', target: 'neura' },
    { source: 'tor1', target: 'aeon' },
    { source: 'tor1', target: 'pwn1' },
    { source: 'pwn1', target: 'neura' },
  ]),
});
export type Props = z.infer<typeof schema>;

export const contract = defineContract({ commands: {}, events: {} });
