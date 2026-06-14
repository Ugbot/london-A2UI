import { defineBrick } from "@/bricks/types";
import { schema } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "UplinkGameEngine",
  description: "Full Uplink hacker game engine: live trace ticker, interactive terminal with command parsing, mission progress tracker, credits system, reroute mechanic, and busted state. Self-contained reactive game state.",
  tags: ["game","engine","uplink","hacker","terminal","interactive","cyberpunk","state"],
  schema,
  acceptsChildren: false,
  Component,
});
