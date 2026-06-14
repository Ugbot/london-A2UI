import { defineBrick } from "@/bricks/types";
import { schema, contract } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "UplinkGame",
  description: "Complete Uplink hacker game: live trace ticker climbing every second, full command-line terminal (connect/crack/hack/mission/reroute/bounty/trace/ls/whoami/clear), 4 mission progress bars, credits system, BUSTED state with reboot, and quick-action buttons. Fully self-contained reactive game state.",
  tags: ["game","uplink","hacker","terminal","interactive","cyberpunk","missions","state","engine"],
  schema,
  acceptsChildren: false,
  contract,
  Component,
});
