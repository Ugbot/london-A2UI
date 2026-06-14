/**
 * Foundry wrapper templates — forge ANY library into a CONFORMANT brick.
 *
 * The agent picks a template kind and supplies a few fills (the library import + a JSX
 * render expression + optional extra props); `composeBrickFromTemplate` emits complete,
 * conformant `schema.ts` + `component.tsx` source that already wires our conventions:
 *   - `sx`/`style` styling (added centrally by the registry, applied by the Renderer)
 *   - `bindKey` reactive reads via `useElementData`
 *   - writes via `dispatch({type:"data/set"})`
 *   - a typed Zod contract (via `defineContract`) so callers/the agent can drive it
 * So a wrapped library "just works" in the builder AND the baked target — the author
 * fills only the library-specific bit, never the boilerplate it usually gets wrong.
 */
export type TemplateKind = "dataviz" | "input" | "display" | "container";

export interface TemplateFills {
  /** Library import statement(s), e.g. 'import { Sparklines, SparklinesLine } from "react-sparklines";'. */
  imports?: string;
  /**
   * A JSX expression rendered by the brick. Locals available depend on the kind:
   *   dataviz   → `rows` (bound array), `props`
   *   input     → `value`, `set(v)`, `props`
   *   display   → `value`, `props`
   *   container → `props` (render `props.children`)
   */
  render: string;
  /** Extra Zod fields inside the z.object({...}), e.g. 'color: z.string().default("#6366f1"),'. */
  schemaFields?: string;
}

export interface ComposedBrick {
  schemaSource: string;
  componentSource: string;
  acceptsChildren: boolean;
}

export interface TemplateInfo {
  kind: TemplateKind;
  title: string;
  description: string;
  /** What the `render` expression can reference. */
  renderLocals: string;
  example: TemplateFills;
}

const SCHEMA_HEAD = `import { z } from "zod";\nimport { defineContract } from "@/bricks/contract";\n`;

function dataviz(f: TemplateFills): ComposedBrick {
  const schemaSource = `${SCHEMA_HEAD}
export const schema = z.object({
  bindKey: z.string().optional().describe("Keyed data element providing the array to render"),
  data: z.array(z.unknown()).optional().describe("Static fallback data when bindKey is unset"),
${f.schemaFields ?? ""}
});
export type Props = z.infer<typeof schema>;

// Typed contract: callers can refresh it; it announces when data arrives.
export const contract = defineContract({
  commands: { refresh: z.object({}) },
  events: { loaded: z.object({ count: z.number().optional() }) },
});
`;
  const componentSource = `"use client";
${f.imports ?? ""}
import * as React from "react";
import { useElementData } from "@/state/hooks";
import { useBrickContract } from "@/bricks/contract-hooks";
import { contract } from "./schema";
import type { Props } from "./schema";

export function Component(props: Props) {
  const rows = useElementData<unknown[]>(props.bindKey, (props.data as unknown[]) ?? []);
  const { emit } = useBrickContract(undefined, contract, {});
  React.useEffect(() => {
    if (Array.isArray(rows)) emit("loaded", { count: rows.length });
  }, [rows, emit]);
  return (
    ${f.render}
  );
}
`;
  return { schemaSource, componentSource, acceptsChildren: false };
}

function input(f: TemplateFills): ComposedBrick {
  const schemaSource = `${SCHEMA_HEAD}
export const schema = z.object({
  bindKey: z.string().optional().describe("Keyed element this control reads/writes"),
  label: z.string().optional(),
${f.schemaFields ?? ""}
});
export type Props = z.infer<typeof schema>;

export const contract = defineContract({
  commands: { clear: z.object({}) },
  events: { changed: z.object({ value: z.unknown() }) },
});
`;
  const componentSource = `"use client";
${f.imports ?? ""}
import * as React from "react";
import { useElementData } from "@/state/hooks";
import { dispatch } from "@/engine/dispatch";
import { useBrickContract } from "@/bricks/contract-hooks";
import { contract } from "./schema";
import type { Props } from "./schema";

export function Component(props: Props) {
  const value = useElementData<unknown>(props.bindKey, "");
  const set = (v: unknown) => {
    if (props.bindKey) dispatch({ type: "data/set", target: props.bindKey, value: v });
    emit("changed", { value: v });
  };
  const { emit } = useBrickContract(undefined, contract, {
    clear: () => { if (props.bindKey) dispatch({ type: "data/set", target: props.bindKey, value: "" }); },
  });
  return (
    ${f.render}
  );
}
`;
  return { schemaSource, componentSource, acceptsChildren: false };
}

function display(f: TemplateFills): ComposedBrick {
  const schemaSource = `${SCHEMA_HEAD}
export const schema = z.object({
  bindKey: z.string().optional().describe("Keyed element providing the value to display"),
  value: z.unknown().optional().describe("Static fallback value"),
${f.schemaFields ?? ""}
});
export type Props = z.infer<typeof schema>;

export const contract = defineContract({ commands: {}, events: {} });
`;
  const componentSource = `"use client";
${f.imports ?? ""}
import * as React from "react";
import { useElementData } from "@/state/hooks";
import type { Props } from "./schema";

export function Component(props: Props) {
  const value = useElementData<unknown>(props.bindKey, props.value);
  return (
    ${f.render}
  );
}
`;
  return { schemaSource, componentSource, acceptsChildren: false };
}

function container(f: TemplateFills): ComposedBrick {
  const schemaSource = `${SCHEMA_HEAD}
export const schema = z.object({
${f.schemaFields ?? ""}
});
export type Props = z.infer<typeof schema>;

export const contract = defineContract({ commands: {}, events: {} });
`;
  const componentSource = `"use client";
${f.imports ?? ""}
import * as React from "react";
import type { Props } from "./schema";

export function Component(props: Props & { children?: React.ReactNode }) {
  return (
    ${f.render}
  );
}
`;
  return { schemaSource, componentSource, acceptsChildren: true };
}

const COMPOSERS: Record<TemplateKind, (f: TemplateFills) => ComposedBrick> = {
  dataviz,
  input,
  display,
  container,
};

/** Compose conformant brick source from a template kind + the agent's fills. */
export function composeBrickFromTemplate(kind: TemplateKind, fills: TemplateFills): ComposedBrick {
  const composer = COMPOSERS[kind];
  if (!composer) throw new Error(`Unknown brick template "${kind}"`);
  if (!fills.render || !fills.render.trim()) throw new Error("template `render` is required");
  return composer(fills);
}

/** The catalog the agent lists to choose a template + know what to fill. */
export const BRICK_TEMPLATES: TemplateInfo[] = [
  {
    kind: "dataviz",
    title: "Data visualization",
    description:
      "Wrap a chart/viz library that renders from an array. Reads its array from bindKey (live) or static data; emits 'loaded'.",
    renderLocals: "rows (bound array), props",
    example: {
      imports: 'import { Sparklines, SparklinesLine } from "react-sparklines";',
      schemaFields: '  color: z.string().default("#6366f1"),',
      render: "<Sparklines data={(rows as number[]) ?? []}><SparklinesLine color={props.color} /></Sparklines>",
    },
  },
  {
    kind: "input",
    title: "Input / control",
    description: "Wrap a control library. Reads/writes its value to bindKey via dispatch; emits 'changed'; supports 'clear'.",
    renderLocals: "value, set(v), props",
    example: {
      imports: 'import Slider from "rc-slider";',
      render: "<Slider value={Number(value) || 0} onChange={(v) => set(v)} />",
    },
  },
  {
    kind: "display",
    title: "Value display",
    description: "Wrap a library that renders a single value (badge, QR, gauge). Reads from bindKey or a static value.",
    renderLocals: "value, props",
    example: {
      imports: 'import QRCode from "qrcode.react";',
      render: "<QRCode value={String(value ?? '')} />",
    },
  },
  {
    kind: "container",
    title: "Layout container",
    description: "Wrap a layout/animation library that wraps children. acceptsChildren = true; render props.children.",
    renderLocals: "props (render props.children)",
    example: {
      imports: 'import { motion } from "framer-motion";',
      render: '<motion.div animate={{ opacity: 1 }} initial={{ opacity: 0 }}>{props.children}</motion.div>',
    },
  },
];
