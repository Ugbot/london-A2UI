import { describe, it, expect } from "vitest";
import { buildProjectFiles } from "./project";
import type { CompositionNode } from "@/bricks/composition";

const tree: CompositionNode = { brick: "Stack", id: "s1", props: {}, children: [] };

describe("buildProjectFiles (runnable project zip)", () => {
  const files = buildProjectFiles({
    name: "My Site",
    bodyHtml: "<h1>Hi</h1>",
    css: ".x{color:red}",
    themeCss: "  --background: #fff;",
    tree,
    stateUpdateB64: "AAAA",
  });

  it("emits a real Vite project (package.json + index.html + styles + data)", () => {
    expect(Object.keys(files).sort()).toEqual(["README.md", "app.json", "index.html", "package.json", "styles.css"]);
    const pkg = JSON.parse(files["package.json"]);
    expect(pkg.scripts.dev).toBe("vite");
    expect(pkg.scripts.build).toBe("vite build");
    expect(pkg.devDependencies.vite).toBeTruthy();
  });

  it("carries the rendered markup + real CSS + the tree/state data island", () => {
    expect(files["index.html"]).toContain("<h1>Hi</h1>");
    expect(files["index.html"]).toContain('href="/styles.css"');
    expect(files["styles.css"]).toBe(".x{color:red}");
    expect(files["index.html"]).toContain("a2ui-app");
    expect(JSON.parse(files["app.json"]).tree.brick).toBe("Stack");
  });

  it("escapes </script> in the embedded JSON", () => {
    const evil = buildProjectFiles({
      name: "x", bodyHtml: "", css: "", themeCss: "",
      tree: { brick: "Text", id: "t", props: { text: "</script>" } }, stateUpdateB64: "",
    });
    expect(evil["index.html"]).not.toContain("</script>x");
    expect(evil["index.html"]).toContain("\\u003c/script");
  });
});
