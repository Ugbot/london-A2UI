import { describe, it, expect } from "vitest";
import {
  composeBrickFromTemplate,
  BRICK_TEMPLATES,
  type TemplateKind,
} from "./foundry-templates";

describe("foundry templates: conformant composition", () => {
  it("dataviz wires bindKey reactive reads + a contract", () => {
    const out = composeBrickFromTemplate("dataviz", {
      imports: 'import { Sparklines, SparklinesLine } from "react-sparklines";',
      schemaFields: '  color: z.string().default("#6366f1"),',
      render: "<Sparklines data={(rows as number[]) ?? []}><SparklinesLine color={props.color} /></Sparklines>",
    });
    expect(out.acceptsChildren).toBe(false);
    // schema is a zod object exporting Props + a contract (so registry adds sx/style + wires contract)
    expect(out.schemaSource).toContain("z.object(");
    expect(out.schemaSource).toContain("export const contract");
    expect(out.schemaSource).toContain("color: z.string()");
    // component reads live data via useElementData and emits the contract event
    expect(out.componentSource).toContain('"use client"');
    expect(out.componentSource).toContain("useElementData");
    expect(out.componentSource).toContain("react-sparklines");
    expect(out.componentSource).toContain("Sparklines");
  });

  it("input wires dispatch writes + clear command", () => {
    const out = composeBrickFromTemplate("input", {
      imports: 'import Slider from "rc-slider";',
      render: "<Slider value={Number(value) || 0} onChange={(v) => set(v)} />",
    });
    expect(out.componentSource).toContain('from "@/engine/dispatch"');
    expect(out.componentSource).toContain("data/set");
    expect(out.componentSource).toContain("set(v)");
    expect(out.schemaSource).toContain("clear: z.object({})");
  });

  it("display reads bindKey/value", () => {
    const out = composeBrickFromTemplate("display", {
      imports: 'import QRCode from "qrcode.react";',
      render: "<QRCode value={String(value ?? '')} />",
    });
    expect(out.componentSource).toContain("useElementData");
    expect(out.componentSource).toContain("QRCode");
  });

  it("container accepts children", () => {
    const out = composeBrickFromTemplate("container", {
      imports: 'import { motion } from "framer-motion";',
      render: "<motion.div>{props.children}</motion.div>",
    });
    expect(out.acceptsChildren).toBe(true);
    expect(out.componentSource).toContain("children");
  });

  it("requires a render expression", () => {
    expect(() => composeBrickFromTemplate("dataviz", { render: "" })).toThrow();
  });

  it("rejects an unknown template kind", () => {
    expect(() => composeBrickFromTemplate("nope" as TemplateKind, { render: "<div/>" })).toThrow();
  });

  it("every catalog example composes cleanly", () => {
    for (const t of BRICK_TEMPLATES) {
      const out = composeBrickFromTemplate(t.kind, t.example);
      expect(out.schemaSource).toContain("export const schema");
      expect(out.componentSource).toContain("export function Component");
    }
  });
});
