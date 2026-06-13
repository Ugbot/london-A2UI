import { z } from "zod";

export const schema = z.object({
  size: z.number().min(50).max(600).default(400).describe("Canvas size in pixels"),
  cubeColor: z.string().default("#6366f1").describe("Main face color of the cube"),
  wireframeColor: z.string().default("#a5b4fc").describe("Wireframe edge color"),
  backgroundColor: z.string().default("#0f0f1a").describe("Background color"),
  rotationSpeed: z.number().min(0.1).max(5).default(1).describe("Rotation speed multiplier"),
  showWireframe: z.boolean().default(true).describe("Overlay a wireframe on the cube"),
});

export type Props = z.infer<typeof schema>;