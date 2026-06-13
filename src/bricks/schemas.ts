/**
 * Zod prop schemas for every brick — the single source of truth.
 *
 * Components (client) import the inferred TYPES from here; `defs.ts` imports the
 * schema VALUES to build BrickDefs. This module has no "use client" so the
 * agent can import the schemas server-side for validation and embedding.
 */
import { z } from "zod";

/** A single (label, value) pair used by the chart bricks. */
export const chartDatum = z.object({
  label: z.string(),
  value: z.number(),
});

// --- Layout ---
export const stackSchema = z.object({
  direction: z.enum(["vertical", "horizontal"]).default("vertical"),
  gap: z.number().int().min(0).max(12).default(4),
  align: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
  justify: z.enum(["start", "center", "end", "between"]).default("start"),
});

export const gridSchema = z.object({
  cols: z.number().int().min(1).max(6).default(2),
  gap: z.number().int().min(0).max(12).default(4),
});

export const sectionSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
});

export const cardSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  footer: z.string().optional(),
});

export const dividerSchema = z.object({
  label: z.string().optional(),
});

// --- Display ---
export const headingSchema = z.object({
  text: z.string(),
  level: z.number().int().min(1).max(4).default(2),
});

export const textSchema = z.object({
  text: z.string(),
  muted: z.boolean().default(false),
});

export const badgeSchema = z.object({
  text: z.string(),
  variant: z.enum(["default", "success", "warning", "danger"]).default("default"),
});

export const statCardSchema = z.object({
  label: z.string(),
  value: z.string(),
  delta: z.string().optional(),
  trend: z.enum(["up", "down", "flat"]).default("flat"),
});

export const listSchema = z.object({
  items: z.array(z.string()),
  ordered: z.boolean().default(false),
});

export const tableSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.string())),
});

export const avatarSchema = z.object({
  name: z.string(),
  src: z.string().optional(),
});

export const imageSchema = z.object({
  src: z.string(),
  alt: z.string().default(""),
  rounded: z.boolean().default(false),
});

export const tabsSchema = z.object({
  tabs: z
    .array(z.object({ label: z.string(), content: z.string() }))
    .min(1),
});

// --- Charts ---
export const barChartSchema = z.object({
  data: z.array(chartDatum).min(1),
  color: z.string().default("#6366f1"),
});

export const lineChartSchema = z.object({
  data: z.array(chartDatum).min(1),
  color: z.string().default("#6366f1"),
});

export const pieChartSchema = z.object({
  data: z.array(chartDatum).min(1),
});

// --- Form ---
export const inputSchema = z.object({
  label: z.string().optional(),
  placeholder: z.string().default(""),
  type: z.enum(["text", "email", "password", "number"]).default("text"),
});

export const selectSchema = z.object({
  label: z.string().optional(),
  options: z.array(z.string()).min(1),
});

export const checkboxSchema = z.object({
  label: z.string(),
  checked: z.boolean().default(false),
});

export const formFieldSchema = z.object({
  label: z.string(),
  hint: z.string().optional(),
});

export const stepperSchema = z.object({
  steps: z.array(z.string()).min(1),
  current: z.number().int().min(0).default(0),
});

export const buttonSchema = z.object({
  label: z.string(),
  variant: z
    .enum(["default", "secondary", "outline", "ghost", "destructive"])
    .default("default"),
  size: z.enum(["default", "sm", "lg"]).default("default"),
});

// --- Feedback ---
export const alertSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  variant: z.enum(["info", "success", "warning", "danger"]).default("info"),
});

export const progressBarSchema = z.object({
  value: z.number().min(0).max(100),
  label: z.string().optional(),
});

// --- Rich / embeds ---
/** A composition node referenced from a non-children position (e.g. a map popup). */
const looseNode = z.object({
  brick: z.string(),
  props: z.record(z.unknown()).optional(),
  children: z.array(z.unknown()).optional(),
});

export const mapSchema = z.object({
  center: z
    .object({ lat: z.number(), lng: z.number() })
    .default({ lat: 51.505, lng: -0.09 }),
  zoom: z.number().int().min(1).max(19).default(12),
  height: z.number().int().min(160).max(720).default(360),
  /**
   * Points on the map. Each marker may carry a `popup` — ANY composition
   * subtree (StatCard, chart, chat, …) — rendered with the same Renderer, so
   * any brick can be hooked onto a location.
   */
  markers: z
    .array(
      z.object({
        lat: z.number(),
        lng: z.number(),
        label: z.string().optional(),
        popup: looseNode.optional(),
      }),
    )
    .default([]),
});

export const keyValueSchema = z.object({
  items: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .min(1),
});

export const timelineSchema = z.object({
  items: z
    .array(
      z.object({
        time: z.string(),
        title: z.string(),
        description: z.string().optional(),
      }),
    )
    .min(1),
});

export const quoteSchema = z.object({
  text: z.string(),
  author: z.string().optional(),
});

export const animatedSchema = z.object({
  animation: z
    .enum(["fade", "slide-up", "slide-down", "zoom", "pulse", "bounce", "spin"])
    .default("fade"),
  duration: z.number().min(0.1).max(10).default(0.6),
  loop: z.boolean().default(false),
});

// --- Collaborative / live (Yjs + SSE) ---
export const collabTextSchema = z.object({
  id: z.string().describe("Stable id identifying this shared text across clients"),
  label: z.string().optional(),
  placeholder: z.string().default("Type together…"),
  rows: z.number().int().min(2).max(20).default(4),
});

export const collabChatSchema = z.object({
  id: z.string().describe("Stable id identifying this shared chat across clients"),
  title: z.string().default("Chat"),
});

export const liveFeedSchema = z.object({
  channel: z.string().describe("SSE channel name to subscribe to"),
  label: z.string().default("Live metric"),
});

export const cryptoChartSchema = z.object({
  product: z
    .string()
    .describe("Coinbase product id, e.g. BTC-USD, ETH-USD, SOL-USD")
    .default("BTC-USD"),
  label: z.string().optional(),
});

// --- Inferred prop types (imported as types by the client components) ---
export type ChartDatum = z.infer<typeof chartDatum>;
export type StackProps = z.infer<typeof stackSchema>;
export type GridProps = z.infer<typeof gridSchema>;
export type SectionProps = z.infer<typeof sectionSchema>;
export type CardProps = z.infer<typeof cardSchema>;
export type DividerProps = z.infer<typeof dividerSchema>;
export type HeadingProps = z.infer<typeof headingSchema>;
export type TextProps = z.infer<typeof textSchema>;
export type BadgeProps = z.infer<typeof badgeSchema>;
export type StatCardProps = z.infer<typeof statCardSchema>;
export type ListProps = z.infer<typeof listSchema>;
export type TableProps = z.infer<typeof tableSchema>;
export type AvatarProps = z.infer<typeof avatarSchema>;
export type ImageProps = z.infer<typeof imageSchema>;
export type TabsProps = z.infer<typeof tabsSchema>;
export type BarChartProps = z.infer<typeof barChartSchema>;
export type LineChartProps = z.infer<typeof lineChartSchema>;
export type PieChartProps = z.infer<typeof pieChartSchema>;
export type InputProps = z.infer<typeof inputSchema>;
export type SelectProps = z.infer<typeof selectSchema>;
export type CheckboxProps = z.infer<typeof checkboxSchema>;
export type FormFieldProps = z.infer<typeof formFieldSchema>;
export type StepperProps = z.infer<typeof stepperSchema>;
export type ButtonBrickProps = z.infer<typeof buttonSchema>;
export type AlertProps = z.infer<typeof alertSchema>;
export type ProgressBarProps = z.infer<typeof progressBarSchema>;
export type MapProps = z.infer<typeof mapSchema>;
export type KeyValueProps = z.infer<typeof keyValueSchema>;
export type TimelineProps = z.infer<typeof timelineSchema>;
export type QuoteProps = z.infer<typeof quoteSchema>;
export type AnimatedProps = z.infer<typeof animatedSchema>;
export type CollabTextProps = z.infer<typeof collabTextSchema>;
export type CollabChatProps = z.infer<typeof collabChatSchema>;
export type LiveFeedProps = z.infer<typeof liveFeedSchema>;
export type CryptoChartProps = z.infer<typeof cryptoChartSchema>;
