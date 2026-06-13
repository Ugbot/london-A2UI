# london-A2UI — research → live reports, built from bricks

**Describe what you want to know. Get a living report.**

london-A2UI is an agent-driven **research and report-building tool**. Ask it a
question in plain language and it will research the web, then *assemble* an
interactive report on a live canvas — charts, KPI cards, tables, maps, network
graphs, even live data feeds — and let you refine it conversationally ("make
@btc-chart candlesticks", "now show it as a table", "recolour it").

It builds **out of bricks, not sand**: the agent never writes raw HTML/JSX. It
composes a validated tree of pre-built, typed React **bricks**, so generation is
reliable and every report is editable, themeable, and shareable.

---

## What it does

- 🔎 **Research** — a `research` tool (Linkup) pulls up-to-date, *sourced*
  answers and feeds them straight into a dashboard (summary, key stats, a
  sources table).
- 🧱 **Composes from ~40 typed bricks** — layout, charts (bar/line/area/pie/
  scatter/**candlestick**/gauge/heatmap), tables, forms, maps (**vector OSM**),
  **D3 force-graphs**, timelines, and more — validated against a Zod registry.
- ✏️ **Refine by conversation** — edit any element in place; `@`-mention or click
  a piece on the canvas to target it; swap a chart for a table, make it live,
  recolour, add/remove/duplicate.
- 📈 **Live & stateful** — bind elements to live data (`DataSource`, SSE,
  Coinbase price feeds); build tabbed / master-detail mini-SPAs with shared
  state and Hotwire-style stream updates.
- 🧪 **Self-extending** — when no brick fits, the **foundry** installs an npm
  library and forges a brand-new brick (with your approval, or "Auto") and adds
  it to the known set. New widgets are embedded into a **pgvector cache** so the
  agent reuses and gets faster over time.
- 👥 **Optional live collaboration** — turn it on to co-build a report with live
  cursors, presence, shared editing, and a shareable session URL.
- 🛟 **Durable & resilient** — flaky network calls run as retrying, checkpointed
  **DBOS** workflows; reports + chat persist to Postgres and restore per thread.

## How it works

```
You ──▶ Chat (CopilotKit) ──▶ Agent (Mastra, in-process AG-UI)
                                   │  tools: research · search/compose bricks ·
                                   │         edit_element · bake/reuse · create_brick
                                   ▼
                         Composition tree (Zod-validated)
                                   ▼
                    Recursive <Renderer> ──▶ Live canvas
                                   ▲
                   pgvector cache · DBOS workflows · Yjs (opt-in collab)
```

The agent assembles a `CompositionNode` tree referencing bricks by name; a
recursive renderer walks it onto the canvas. Successful reports are distilled
into reusable templates and cached for next time.

## Stack

Next.js 16 · React 19 · CopilotKit v2 (AG-UI) · Mastra agent · Zod · Tailwind v4
· recharts / D3 / Leaflet+MapLibre (vector tiles) · pgvector + Ollama embeddings
· Yjs · TanStack Query / Zustand · DBOS · Linkup.

## Getting started

Prereqs: Node 20+, a container runtime (Docker/Podman) for the local Postgres
(pgvector) + Redis stack, and Ollama with `nomic-embed-text` for embeddings.

```bash
npm install
cp .env.example .env   # then fill in the keys below
npm run dev            # starts the pgvector/redis stack, collab server, and UI
```

Open http://localhost:3000 and try:

> "Research the 2025 EV market and build me a dashboard."
> then: "make it a tabbed report with a chart and a sources table"
> then: "@... recolour it green"

### Environment

```
OPENAI_API_KEY=...        # or set OPENAI_BASE_URL + AGENT_MODEL for a local model
AGENT_MODEL=gpt-5.4-nano
LINKUP_API_KEY=...        # web research
# pgvector (the dev stack maps Postgres to :5433), Ollama, DBOS system DB — see .env.example
```

## Tests

```bash
npm test   # vitest: composition validation, tree edits, store reducer
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).
