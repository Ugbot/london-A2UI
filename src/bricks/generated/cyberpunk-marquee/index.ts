import { defineBrick } from "@/bricks/types";
import { schema, contract } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "CyberpunkMarquee",
  description: "A flashing, scrolling cyberpunk-style marquee ticker with neon glow, blinking elements, and a scanline overlay. Shows agent handle and live status snippets scrolling across.",
  tags: ["marquee","ticker","hacker","cyberpunk","neon","animation","uplink","game","flash"],
  schema,
  acceptsChildren: false,
  contract,
  Component,
});
