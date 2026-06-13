
import { z } from "zod";

export const schema = z.object({
  size: z.number().default(420).describe("Canvas size in px"),
  cubeColor: z.string().default("#6366f1").describe("Cube face color"),
  wireframeColor: z.string().default("#a5b4fc").describe("Wireframe edge color"),
  backgroundColor: z.string().default("#0f0f1a").describe("Canvas background color"),
  rotationSpeed: z.number().default(1.2).describe("Rotation speed multiplier"),
  showWireframe: z.boolean().default(true).describe("Show wireframe overlay"),
  bounceSpeed: z.number().default(1.5).describe("Bounce speed multiplier"),
  bounceHeight: z.number().default(0.6).describe("Bounce height in Three.js units"),
  lightColor: z.string().default("#ffffff").describe("Point light color"),
  lightIntensity: z.number().default(2).describe("Point light intensity"),
});

export type Props = z.infer<typeof schema>;
