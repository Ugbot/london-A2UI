import { defineBrick } from "@/bricks/types";
import { schema } from "./schema";
import { Component } from "./component";

export const brick = defineBrick({
  name: "SpinningCubeLit",
  description: "A Three.js spinning 3D cube with dynamic lighting (ambient + point lights) and a bounce animation.",
  tags: ["threejs","3d","animation","webgl","cube","lights","bounce"],
  schema,
  acceptsChildren: false,
  Component,
});
