# Data layer: connections, datasets & bindings for data-driven SPAs

## Context
Today the builder composes SPAs from typed bricks with a keyed store, live
`bindKey` bindings, `DataSource` (client-only GET, no auth), `ActionButton`, and
charts/MasterDetail. But each report is hand-built; there's no way to **map a SPA
over a CMS / dataset**. The goal is a tool sitting **between Gatsby and Apache
Superset**: source content/data from external systems (REST/OpenAPI CMSs, APIs),
**bind** it into the page (collections → repeated templated views like Gatsby/Wix
repeaters; datasets → charts + filters like Superset), and **write back** (forms
that create/update content). Chat stays the primary way to wire it; a visual
**Data panel** manages connections + secrets.

User decisions (locked):
- HTTP: **server proxy by default** (auth/secrets/CORS) + **client direct-fetch opt-in** for public URLs.
- Specs: **OpenAPI import + conversational/manual** endpoint definition.
- Surface: **visual Data panel + agent**, chat primary.
- Scope can be large; the building blocks are standard — don't over-engineer.

This tool's core job is **front-end design & build** — designing and assembling
the views/SPA. This data layer is strictly the *input* side: how external/CMS
data maps **into** those designed views (it is not a backend/ETL tool). Every
phase below serves the front end — datasets feed bricks, bindings template
records, forms write back — so the agent/user can design a UI and point it at data.

The building blocks reuse what exists: brick pipeline (`schemas.ts`→`components.tsx`
→`defs.ts`→auto `registry.ts`), keyed store (`src/state/store.ts` +
`useElementData`), TanStack Query (`QueryProvider`), `getJsonPath` + the
`DataSource` status-dot UI, the API-route hardening idiom (id regex + size caps +
sanitized errors + `runtime="nodejs"`), idempotent `migrate()`, the `createTool`
agent-tool idiom, the `useHumanInTheLoop`/`FoundryCard` HITL idiom, and the
header-dropdown idiom (`ReportsMenu`/`StyleMenu`/`ModelMenu`).

## Core model (the data layer)
- **Connection** — a data source: `{ name, baseUrl, auth, defaultHeaders, endpoints[] }`. Secrets server-only. Endpoints come from OpenAPI import or manual definition.
- **Dataset** — a named, parameterized query against a connection endpoint that yields records (a collection array or a single record), written into the keyed store under a dataset key; re-runs when its params change. (Backed by the `ApiData` brick.)
- **Bindings** — two kinds:
  - **Value binding** (`bindKey` + `jsonPath`, exists): a brick prop ← a store value.
  - **Field binding** (`bindField`, NEW): a brick prop ← a field of the *current record* inside a Repeater/Detail context — the CMS templating primitive.
- **Repeater/Collection brick** (NEW) — iterates a dataset array and renders its child template once per record inside a **RecordProvider** (React context); children read fields via `bindField`. (Gatsby/Wix repeater; also powers data-bound MasterDetail.)
- **Filters** — form inputs that write to param store keys; datasets depend on those keys → re-query (Superset filters). Reuses store + inputs + `ApiData` query.
- **Form (mutation)** — collects bound inputs and submits create/update to a connection endpoint via the proxy, then refreshes affected datasets (write-back to the CMS).

## Architecture & files

### Phase 1 — Connections data layer + redaction (low risk)
- `src/server/db.ts`: add a `connections` table to `migrate()` (`id uuid pk, name, base_url, auth jsonb, default_headers jsonb, endpoints jsonb, timestamps`). No embedding/HNSW.
- `src/server/connections.ts` (new): CRUD with parameterized queries (mirror `cache.ts`). Two shapes — `ConnectionFull` (server-only, holds secrets) and `ConnectionRedacted` (the ONLY shape crossing to client/agent). `redact(full)`: strip `token/key/password/username`, set `hasSecret`, mask sensitive `defaultHeaders` values (`/authorization|api[-_]?key|token|secret|cookie/i` → `••••`). `getConnectionFull(id)` is server-internal only (never returned by an HTTP GET).
- Test: `src/server/connections.test.ts` (pure `redact`).

### Phase 2 — Server proxy + SSRF (HIGHEST RISK — build/test first)
- `src/lib/ssrf.ts` (new, unit-tested): given a URL (and optional allowed host from a connection's baseUrl), enforce: https-only (http allowed only for localhost behind a dev flag); DNS-resolve host and reject if any address is loopback/private/link-local/metadata (`127/8, ::1, 10/8, 172.16/12, 192.168/16, 169.254/16 incl. 169.254.169.254, fc00::/7, fe80::/10`); reject literal private IPs; host-allowlist match when connection-scoped.
- `src/app/api/proxy/route.ts` (new, `runtime="nodejs"`): `POST { connectionId?, endpointId?, url?, method?, pathParams?, query?, headers?, body? }`. Loads `getConnectionFull`, resolves endpoint method+path, builds the URL (baseUrl + path with `{param}` substitution + query), injects auth (`bearer`/`apiKey` header/`basic`) — **auth headers win over caller headers**. SSRF-guard the target; `redirect:"manual"` + re-check on `Location`; `AbortController` timeout (`PROXY_TIMEOUT_MS`); response size cap (~2 MB); sanitized errors (`console.error` server-side); optional `WIDGET_API_KEY` bearer gate. Factor the request core into a shared fn reused by the `call_api` tool.
- Client direct-fetch path (`mode:"direct"`): brick fetches the URL straight from the browser (today's `DataSource` behaviour); only valid when no `connectionId`/auth; subject to target CORS; no secret injection.
- Test: `src/lib/ssrf.test.ts` (stub `dns.lookup`; cover IPv4/IPv6 ranges, protocol, host-allowlist).

### Phase 3 — `/api/connections` CRUD + OpenAPI import (medium risk)
- `src/app/api/connections/route.ts` (new): `GET` → redacted list; `POST { source:"openapi", specUrl?|specJson? } | { source:"manual", name, baseUrl, authType, endpoints? }` → create; plus secret write (`PUT .../secret`, write-only — GET never returns it) and delete. Hardened like canvas/chat routes.
- `src/lib/openapi.ts` (new, unit-tested): **minimal hand-parser, no new dependency** (avoids `swagger-parser`'s heavy tree + remote-`$ref` SSRF + Turbopack bundling risk). Extract `info.title`→name, `servers[0].url`→baseUrl, and per `paths[p][method]`: `EndpointDef {id, method, path, summary, requestSchema}` from `requestBody.content["application/json"].schema`; resolve only local `#/components/...` `$ref` with a visited/depth guard; **never fetch remote `$ref`**; cap endpoint count + spec size. Fetch `specUrl` through `ssrf.ts`.
- Test: `src/lib/openapi.test.ts`.

### Phase 4 — Bricks: read, bind, repeat, submit (medium risk)
All via `schemas.ts`→`components.tsx`→`defs.ts` (auto-registered; `ensureCache` re-seeds on brick-count change). Reuse `getJsonPath`, the status-dot UI, `useWidgetStore`, `useElementData`, TanStack Query.
- **`ApiData`** (enhanced DataSource; keep `DataSource` for back-compat): `{ connectionId?, endpointId?, url?, method, mode:"proxy"|"direct", query?, headers?, body?, targetKey, jsonPath?, intervalMs, label? }`. `useQuery` keyed on the request; proxy mode → `POST /api/proxy`; writes `set(targetKey, …)`. This is the **Dataset** engine. Existing bound charts/stats/tables need zero changes.
- **Field binding**: add optional `bindField` to display bricks (Text, StatCard, Image, Badge, KeyValue, etc.). A new `RecordProvider` (React context) holds the current record; `useRecordField(path)` reads it. When `bindField` is set the brick shows the record's field (path via `getJsonPath`); precedence: `bindField` (record) → `bindKey` (store) → static prop. No regression when unset.
- **`Repeater`** (new, `acceptsChildren`): `{ bindKey (dataset array store key), as?, empty? }`. Reads the array from the store, renders its FIRST child as a template once per record wrapped in `RecordProvider`. Powers Gatsby/Wix-style collection views; also usable to data-bind `MasterDetail` (follow-up: a `bindKey` on MasterDetail items).
- **Form inputs** (`Input`/`Select`/`Checkbox`): add optional `bindKey` — when set they become controlled (read `useElementData`, write `set(bindKey, value)` on change), coercing number/boolean. Unbound = today's local behaviour. These double as **filters** (write to param keys that a Dataset's `query` references).
- **`Form`** (new, `acceptsChildren`): `{ connectionId?, endpointId?, url?, method:"POST"|…, mode, fieldsPrefix, submitLabel, responseKey?, successMessage, refetchKeys? }`. On submit, collect store keys under `fieldsPrefix` (pure `assembleFormBody(data, prefix)`), POST via proxy/direct (TanStack `useMutation` for pending/error), write `responseKey`, and invalidate/refetch `refetchKeys` datasets.
- Tests: `src/bricks/form.test.ts` (`assembleFormBody`), and a `record-binding` test for `useRecordField`/path resolution if extracted as a pure helper.

### Phase 5 — Agent tools + prompt (low risk)
- `src/mastra/tools.ts` (+ `cacheTools`): `list_connections` (redacted), `import_openapi({specUrl?|specJson?})`, `add_endpoint({connectionId, method, path, summary?, requestSchema?})`, optional `call_api` (proxied test call, truncated/sanitized).
- `src/mastra/prompt.ts`: a "Connecting live data / building data-driven views" section — call `list_connections` first; reuse/`import_openapi`/`add_endpoint`; wire `ApiData` (dataset) → `Repeater`+`bindField` (collection view) or charts via `bindKey` (dashboard); inputs as filters writing param keys; `Form` for write-back; default `mode:"proxy"`; **never request secrets in chat — tell the user to add them in the Data panel** (same HITL philosophy as `create_brick`).

### Phase 6 — Visual Data panel (low risk)
- `src/components/DataPanel.tsx` (new, follow `ReportsMenu` dropdown structure), rendered in `page.tsx` `headerExtra`. MVP: list connections (redacted; "secret set" badge from `hasSecret`); add connection (manual or OpenAPI URL/JSON); enter/update secret (write-only endpoint; shows `••••` when set); view endpoints; delete. Stretch: visual field-binding (click input → assign `bindKey`; pick connection+endpoint for a Form/ApiData) and a "Test" button via `call_api`.

### Phase 6.5 — Mortar: reactive TS logic on a proper state store
The whole app already runs on a reactive keyed store (`src/state/store.ts`
Zustand + `useElementData`/`bindKey`); **mortar** is typed logic layered onto that
SAME store so everything is real-time. The store is the single source of truth:
data sources write keys, bricks subscribe to keys (`bindKey`), and **mortar
registers DERIVED keys** that recompute automatically when their inputs change —
the "React magic" is the store's subscription graph propagating updates to every
bound brick instantly. Bricks = view, store = reactive state, mortar = the typed
derivations/effects between them.

Store additions (`src/state/store.ts`):
- `registerDerived(key, deps[], fn)` — a computed key: subscribe to `deps`, and
  whenever any changes, recompute `fn({ deps, get })` and `set(key, …)`. Bricks
  bound to `key` re-render live. This is the reactive backbone for mortar.
- Mortar functions plug in as the `fn`: **transforms** (dataset raw → brick shape,
  richer than `jsonPath`), **computed bindings** (`total = sum(items.price)`,
  formatting), and **actions** (run on `ActionButton`/`Form`, may `set` many keys).
- Brick props: `transform` on `ApiData`/`Repeater` (post-fetch shaping), and
  `bindCompute` on display bricks (a derived value) alongside `bindKey`/`bindField`.

**Modularity rule:** all generated TS (mortar AND foundry bricks) must be *fully
modular* — real ES modules with explicit imports/exports, one concern per module,
composable and reusable (a mortar fn can import another). No inline snippets or
giant single-blob sources; persisted source is a proper module, registered by id,
importable by other generated modules. This keeps generated logic testable,
tree-shakeable, and re-composable like the bricks themselves.

Design (mirrors the foundry, but logic not components; reactive not one-shot):
- `mortar` registry + DB table `{ id, name, description, source, signature, kind }`; agent authors via a `create_mortar` HITL tool (approval unless Auto) or the user adds one in a Mortar panel. Persisted + reloadable like `generated_bricks`.
- Execution: transpile the TS source (sucrase/esbuild) to a function body and run in a **guarded scope** (`new Function` with a frozen, allow-listed context: inputs, a store snapshot/`get`, current record, pure helpers — NO `fetch`/`window`/`process`/network; outbound calls go through Connections, never mortar). Pure-by-contract; wired into `registerDerived` so results flow through the store. Errors caught + surfaced like a brick ErrorBoundary, never crash the canvas.
- New: `src/mortar/registry.ts`, `src/mortar/run.ts` (transpile+sandbox), `src/server/mortar.ts` (persist), `src/app/api/mortar/route.ts`, a `create_mortar` tool, `MortarPanel`; plus `registerDerived` in `store.ts`.
- Tests: `registerDerived` recomputes on dep change and updates subscribers; sandbox escapes blocked (`fetch`/`process`/`globalThis` unavailable); a transform maps a sample payload; bad source is caught not thrown.

Sequence mortar AFTER Phase 4 (it plugs into ApiData/Repeater/bindings + the store); ship `registerDerived` + transforms first (highest value for CMS/dataset mapping), then computed bindings, then actions.

### Phase 6.6 — Transactional edits + undo/redo ("Figma with JS")
The canvas tree lives in a Yjs doc (`doc.getMap("canvas")`), so we get
transactional, collab-aware history nearly for free with **`Y.UndoManager`**:
- Wrap each logical edit (`applyTree`, `edit_element`, add/remove/duplicate, drag-
  reorder) in a single `doc.transact(...)` so it's ONE undo step.
- Attach a `Y.UndoManager` to the canvas map; expose `undo()/redo()/canUndo/canRedo`
  from `useSharedWidget`/a `useHistory` hook; wire Cmd/Ctrl+Z and Shift+Cmd/Ctrl+Z
  + header buttons. UndoManager only reverts local origins → safe under collab.
- **Modularity for cheap VDOM edits:** `NodeRenderer` must key every child by its
  stable `node.id` (not array index) so React reconciles surgically — moving/
  editing one brick doesn't remount siblings, and undo/redo diffs cleanly. Keep
  each brick a small, self-contained component (already the pattern); the data
  bindings (`bindKey`/`bindField`) read from the store/record context so a value
  change re-renders only the bound brick, not the tree.

### Phase 7 — Stretch
GraphQL connection type (common for headless CMS); data-bound `MasterDetail`; request-time IP pinning for full DNS-rebind safety; dataset result caching/pagination; SQL connection (true Superset parity) behind the proxy.

## Security (follow the repo's route conventions)
- Secrets server-only; the redacted shape is the only thing that crosses to client/agent; secret-write endpoint is write-only.
- Proxy is the sole user-controlled outbound fetch → SSRF guard is mandatory and tested before any brick uses it; method allowlist, timeout, size cap, manual-redirect re-check, sanitized errors.
- OpenAPI `specUrl` import goes through the same SSRF guard; no remote `$ref` fetch.
- Parameterized SQL only (existing pg idiom); audit-log connection create/secret-set + proxy calls (reuse `console.error`/existing logging).
- Optional `WIDGET_API_KEY`-style gate on `/api/proxy` + `/api/connections` for locked deployments.

## Verification (end-to-end + tests)
- **Dashboard (Superset-side):** import an OpenAPI spec → connection appears with endpoints; `ApiData` (proxy) fills a dataset key; a chart bound via `bindKey` renders it; a Select filter writes a param key → dataset re-queries → chart updates.
- **Collection (Gatsby-side):** `ApiData` fetches a list → `Repeater` renders a templated card per record with `bindField` fields; verify N cards from N records.
- **Auth/secrets:** bearer connection + secret set in panel → proxy call succeeds and **no token appears** in any browser-visible response (devtools check on `/api/connections` GET + proxy response).
- **Write-back:** bound inputs + `Form` (connection+endpoint) → submit → success + `responseKey` populates a bound brick + `refetchKeys` dataset refreshes.
- **SSRF negatives:** proxy to `127.0.0.1` / `169.254.169.254` / `10.0.0.1` / DNS-resolves-private / host≠connection-baseUrl → all rejected, sanitized.
- **Unit (vitest, `src/**/*.test.ts`, node env):** `ssrf.test.ts`, `connections.test.ts` (redaction), `openapi.test.ts` (parse + local-only `$ref` + caps), `form.test.ts` (`assembleFormBody`), record-field resolution. Keep `npm test` green.

## Sequencing
Phases 1→3 give a working proxy+connections+import backend (testable via curl). Phase 4 makes it usable in widgets (read → bind → repeat → submit). Phases 5–6 make it agent- and human-friendly. Each phase is independently shippable; Phase 2 (SSRF) is the security-critical core and is built/tested in isolation first.
