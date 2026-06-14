import { defineBrick } from "@/bricks/types";
import { schema, contract } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "HackerTerminal",
  description: "An interactive hacker terminal emulator with a command log, blinking cursor, and typed command input. Supports fake Uplink-style commands (crack, trace, connect, ls, hack, bounty).",
  tags: ["terminal","hacker","game","console","interactive","uplink","cyberpunk"],
  schema,
  acceptsChildren: false,
  contract,
  Component,
});
