import { defineBrick } from "@/bricks/types";
import { schema, contract } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "NetworkMap",
  description: "An Uplink-style interactive network infiltration map showing servers as nodes with connection lines. Click a node to \"ping\" it. Visual cyberpunk neon styling with SVG.",
  tags: ["network","map","nodes","graph","hacker","game","uplink","cyberpunk","svg"],
  schema,
  acceptsChildren: false,
  contract,
  Component,
});
