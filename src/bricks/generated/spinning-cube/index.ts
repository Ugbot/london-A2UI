import { defineBrick } from "@/bricks/types";
import { schema } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "SpinningCube",
  description: "A Three.js animated spinning 3D cube with customizable size, colors, and rotation speed.",
  tags: ["threejs","3d","animation","webgl","canvas","cube"],
  schema,
  acceptsChildren: false,
  Component,
});
