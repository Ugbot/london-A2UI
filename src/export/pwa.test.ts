import { describe, it, expect } from "vitest";
import * as Y from "yjs";
import { buildReportBundle, bytesToBase64, REPORT_SW_SOURCE } from "./pwa";
import { writeTree, readTree, applyDataAction, readData } from "@/collab/doc-model";
import type { CompositionNode } from "@/bricks/composition";

function base64ToBytes(b64: string): Uint8Array {
  const bin = typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const tree: CompositionNode = {
  brick: "Stack",
  id: "stack-1",
  props: {},
  children: [{ brick: "Heading", id: "heading-1", props: { text: "Quarterly", level: 1 } }],
};

describe("export PWA bundle", () => {
  it("embeds tree + state + manifest + offline SW, and exposes window.__A2UI__", () => {
    const doc = new Y.Doc();
    writeTree(doc, tree);
    applyDataAction(doc, { action: "set", target: "kpi", value: 42 });
    const stateUpdateB64 = bytesToBase64(Y.encodeStateAsUpdate(doc));

    const html = buildReportBundle({
      title: "Q-Report",
      bodyHtml: "<h1>Quarterly</h1>",
      themeCss: "  --background: #fff;",
      tree,
      stateUpdateB64,
    });

    expect(html).toContain("<title>Q-Report</title>");
    expect(html).toContain('rel="manifest"');
    expect(html).toContain('name="theme-color"');
    expect(html).toContain('id="a2ui-tree"');
    expect(html).toContain('id="a2ui-state"');
    expect(html).toContain("window.__A2UI__");
    expect(html).toContain("a2ui-report-v1"); // the report SW is inlined
    expect(html).toContain("<h1>Quarterly</h1>"); // frozen render for offline paint
    expect(REPORT_SW_SOURCE).toContain("caches");
  });

  it("the embedded Yjs state rehydrates a fresh doc offline (carries the spine)", () => {
    const doc = new Y.Doc();
    writeTree(doc, tree);
    applyDataAction(doc, { action: "set", target: "kpi", value: 42 });
    const stateUpdateB64 = bytesToBase64(Y.encodeStateAsUpdate(doc));

    // simulate the artifact booting offline: decode the embedded state into a fresh doc
    const fresh = new Y.Doc();
    Y.applyUpdate(fresh, base64ToBytes(stateUpdateB64));
    expect(readTree(fresh)).toEqual(tree);
    expect(readData(fresh, "kpi")).toBe(42);
  });

  it("carries an optional liveSyncUrl for design push / CRDT sync", () => {
    const html = buildReportBundle({
      title: "Live",
      bodyHtml: "<div/>",
      themeCss: "",
      tree,
      stateUpdateB64: "",
      liveSyncUrl: "wss://sync.example.com/room-1",
    });
    expect(html).toContain("wss://sync.example.com/room-1");
  });

  it("escapes </script> in embedded JSON (no breakout)", () => {
    const evil: CompositionNode = { brick: "Text", id: "t", props: { text: "</script><x>" } };
    const html = buildReportBundle({ title: "x", bodyHtml: "", themeCss: "", tree: evil, stateUpdateB64: "" });
    expect(html).not.toContain("</script><x>");
    expect(html).toContain("\\u003c/script");
  });
});
