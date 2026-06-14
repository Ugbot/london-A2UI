/**
 * Build a RUNNABLE front-end project from a baked design — a real Vite static site you
 * can `npm install && npm run dev` (or `build` + deploy). Carries the rendered markup +
 * the REAL compiled CSS (styled offline), plus the composition tree + Yjs state as data
 * islands so the A2UI runtime can re-hydrate/extend it later. `buildProjectFiles` is pure
 * (path → content) for testing; the ExportMenu zips the result.
 *
 * v1 ships a static (frozen-render) site — interactive React-bricks output requires
 * shipping the A2UI runtime as a package (a later step); the data islands keep that path
 * open.
 */
import type { CompositionNode } from "@/bricks/composition";

export interface ProjectInput {
  name: string;
  bodyHtml: string;
  css: string;
  themeCss: string;
  tree: CompositionNode | null;
  stateUpdateB64: string;
}

function slug(name: string): string {
  return name.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "a2ui-site";
}

function esc(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
}

/** Returns a map of project-relative path → file contents. */
export function buildProjectFiles(input: ProjectInput): Record<string, string> {
  const pkgName = slug(input.name);
  const packageJson = JSON.stringify(
    {
      name: pkgName,
      private: true,
      version: "0.1.0",
      type: "module",
      scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
      devDependencies: { vite: "^5.4.0" },
    },
    null,
    2,
  );

  const indexHtml = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${input.name}</title>
<link rel="stylesheet" href="/styles.css" />
<style>:root{
${input.themeCss}
}
body{background:var(--background);color:var(--foreground);font-family:Inter,system-ui,Arial,sans-serif;padding:24px;margin:0}</style>
</head>
<body>
<div id="app">${input.bodyHtml}</div>
<script type="application/json" id="a2ui-app">${esc({ tree: input.tree, state: input.stateUpdateB64 })}</script>
</body>
</html>`;

  const readme = `# ${input.name}

A front-end exported from A2UI. It's a static Vite site, fully styled (the real compiled
CSS is in \`styles.css\`).

\`\`\`bash
npm install
npm run dev      # serve locally
npm run build    # → dist/ (deploy anywhere)
\`\`\`

The composition tree + Yjs state are embedded in \`index.html\` (\`#a2ui-app\`) so the A2UI
runtime can re-hydrate or extend this project later.
`;

  return {
    "package.json": packageJson,
    "index.html": indexHtml,
    "styles.css": input.css,
    "app.json": esc({ tree: input.tree, state: input.stateUpdateB64 }),
    "README.md": readme,
  };
}
