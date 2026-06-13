# london-A2UI — harden designs into reusable components

> **Hackathon project.** A design tool for **dashboards, widgets, and reports**
> that works from a chat canvas **and over an API** — and turns every design it
> produces into a typed, reusable, re-composable component.

**The pitch:** most "AI builds a UI" demos spit out throwaway JSX you can't trust,
reuse, or call from anywhere. london-A2UI does the opposite. You describe what you
want; an agent **composes it out of pre-built, typed React bricks** (never raw
markup), validates it against a schema, renders it on a live canvas — and
**distills the result into a reusable template** that's searchable, callable over
HTTP, and gets better the more you use it. Designs harden into components.

---

## Three ways in

1. **Chat canvas** — describe a dashboard/report, refine it conversationally
   (`@`-mention or click a piece to target it, "make it live", "swap to
   candlesticks", "recolour"), optionally co-build it live with others.
2. **HTTP API** — `POST /api/widget { "prompt": "..." }` returns a validated
   composition tree as JSON: re-importable, renderable, version-controllable.
   Build widgets from a script, a CI job, another app — anywhere.
3. **The cache** — every successful design is distilled into a **template with
   typed holes** and embedded into pgvector, so the next request *reuses* it
   instead of regenerating. Your designs become a growing component library.

## The API

```bash
# Build a widget and get back a reusable composition tree
curl -X POST http://localhost:3000/api/widget \
  -H 'content-type: application/json' \
  -d '{ "prompt": "a sales dashboard with KPI cards and a monthly bar chart" }'
```

```jsonc
{
  "ok": true,
  "widget": { "brick": "Stack", "id": "stack-1", "children": [ /* … */ ] },
  "elements": [ { "id": "stat-card-1", "brick": "StatCard", "label": "Revenue" }, … ],
  "attempts": 1,
  "message": "Here's your sales dashboard…"
}
```

- The returned `widget` is the canonical artifact: import it into the canvas
  (Export ▸ Import JSON), render it with the brick library, diff it in git.
- **Pick the model per call:** `"model": "anthropic:claude-opus-4-8"` (or any id;
  defaults to the server's `AGENT_PROVIDER`/`AGENT_MODEL`).
- **Auth:** set `WIDGET_API_KEY` to require `Authorization: Bearer <key>`; CORS +
  a request timeout are built in. `GET /api/widget` returns live usage docs.

## What it can build

- 🔎 **Researched reports** — a `research` tool (Linkup) pulls up-to-date,
  *sourced* answers and turns them into a summary + key stats + sources table.
- 🧱 **~40 typed bricks** — layout, charts (bar/line/area/pie/scatter/
  **candlestick**/gauge/heatmap), tables, forms, maps (**vector OSM**), **D3
  force-graphs**, master-detail SPAs, timelines — all validated against a Zod
  registry, so generation is reliable and every output is editable + themeable.
- 📈 **Live & stateful** — bind elements to live data (`DataSource`, SSE,
  **live Coinbase price feeds**); build tabbed / master-detail mini-SPAs with
  shared state and Hotwire-style stream updates.
- ✏️ **Refine by conversation** — edit any element in place; swap a chart for a
  table, make it live, recolour, add/remove/duplicate — targeted by id.
- 🧪 **Self-extending foundry** — when no brick fits, it installs an npm library
  and **forges a new brick** (with approval, or "Auto"), then embeds it into the
  cache so it's known next time.
- 👥 **Optional live collaboration** — turn it on to co-build with live cursors,
  presence, shared editing, and a shareable session URL.
- 🛟 **Durable & resilient** — flaky model/research calls run as retrying,
  checkpointed **DBOS** workflows with connection-level retries; canvases persist
  to Postgres per session.

## How it works

```
            ┌─────────────── chat canvas (CopilotKit) ───────────────┐
You ──▶  ───┤                                                        ├──▶ Agent (Mastra, in-process AG-UI)
            └─────────────── POST /api/widget (HTTP) ────────────────┘        │  tools: research · search/compose bricks ·
                                                                              │         edit_element · bake/reuse · create_brick
                                                                              ▼
                                                          Composition tree  ──▶  Zod validation
                                                                              ▼
                                                  Recursive <Renderer> ──▶ live canvas   |   JSON ──▶ API caller
                                                                              ▲
                                            pgvector cache (reusable templates) · DBOS · Yjs (opt-in collab)
```

The agent assembles a `CompositionNode` tree that references bricks by name;
the same engine renders it to the canvas (interactive) or returns it as JSON
(API). Successful designs are distilled into reusable templates and cached —
that's the "hardening into components" loop.

## Model selection

The composer's model is configurable **and switchable at runtime**:

- **Default** via env: `AGENT_PROVIDER=anthropic` + `AGENT_MODEL=claude-sonnet-4-6`
  (Anthropic by default; set `AGENT_PROVIDER=openai` for OpenAI / a local
  OpenAI-compatible endpoint via `OPENAI_BASE_URL`).
- **Per request** via the API `model` field, or the **model dropdown** in the
  canvas header — no restart needed.

## Stack

Next.js 16 · React 19 · CopilotKit v2 (AG-UI) · Mastra agent · Anthropic Claude /
OpenAI (swappable) · Zod · Tailwind v4 · recharts / D3 / Leaflet+MapLibre (vector
tiles) · pgvector + Ollama embeddings · Yjs · TanStack Query / Zustand · DBOS ·
Linkup.

## Getting started

Prereqs: Node 20+, a container runtime (**Podman** or Docker) for the local
Postgres (pgvector) stack, and Ollama with `nomic-embed-text` for embeddings.

```bash
npm install
cp .env.example .env    # fill in the keys below
npm run dev             # starts the pgvector stack, collab server, and UI
```

Open http://localhost:3000 and try:

> "Build a crypto trading dashboard: live BTC, ETH and SOL charts plus a market-intelligence section."
> then: "@btc-chart make it candlesticks", "add a sources table"

### Environment

```
# Model provider — Anthropic by default; switchable at runtime per request/UI.
ANTHROPIC_API_KEY=...
AGENT_PROVIDER=anthropic
AGENT_MODEL=claude-sonnet-4-6
# OPENAI_API_KEY=...           # or AGENT_PROVIDER=openai (+ OPENAI_BASE_URL for Ollama)

LINKUP_API_KEY=...             # web research
# WIDGET_API_KEY=...           # optional: require a bearer token on POST /api/widget
# pgvector (dev stack maps Postgres to :5433), Ollama, DBOS system DB — see .env.example
```

## Tests

```bash
npm test   # vitest: composition validation, tree edits, store reducer
```

## License

Apache-2.0 — see [LICENSE](./LICENSE).
