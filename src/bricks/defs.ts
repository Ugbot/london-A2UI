/**
 * Brick definitions — wires each Zod schema (schemas.ts) to its React
 * component (components.tsx) with a semantic description and tags. This module
 * is server-safe: it touches schemas (real values) and component references
 * (client refs the agent never invokes), so the agent can import it for
 * listing/validation/embedding.
 */
import { defineBrick } from "./types";
import type { BrickDef } from "./types";
import * as C from "./components";
import * as CC from "./collab-components";
import { Map as MapBrick } from "./map-components";
import * as S from "./schemas";

export const BRICKS: BrickDef[] = [
  // --- Layout ---
  defineBrick({
    name: "Stack",
    description: "Vertical or horizontal flexbox layout that stacks its children with a configurable gap and alignment.",
    tags: ["layout", "flex", "container", "vertical", "horizontal"],
    schema: S.stackSchema,
    acceptsChildren: true,
    Component: C.Stack,
  }),
  defineBrick({
    name: "Grid",
    description: "Responsive grid layout arranging children into a fixed number of columns.",
    tags: ["layout", "grid", "columns", "container", "dashboard"],
    schema: S.gridSchema,
    acceptsChildren: true,
    Component: C.Grid,
  }),
  defineBrick({
    name: "Section",
    description: "A titled section with an optional heading and description that groups related content.",
    tags: ["layout", "section", "group", "heading", "container"],
    schema: S.sectionSchema,
    acceptsChildren: true,
    Component: C.Section,
  }),
  defineBrick({
    name: "Card",
    description: "A bordered surface card with optional title, description and footer that wraps content.",
    tags: ["layout", "card", "panel", "surface", "container"],
    schema: S.cardSchema,
    acceptsChildren: true,
    Component: C.Card,
  }),
  defineBrick({
    name: "Divider",
    description: "A horizontal rule that separates content, optionally with a centered label.",
    tags: ["layout", "divider", "separator", "rule"],
    schema: S.dividerSchema,
    Component: C.Divider,
  }),

  // --- Display ---
  defineBrick({
    name: "Heading",
    description: "A section heading at levels 1-4 for titles and subtitles.",
    tags: ["display", "heading", "title", "text"],
    schema: S.headingSchema,
    Component: C.Heading,
  }),
  defineBrick({
    name: "Text",
    description: "A paragraph of body text, optionally muted for secondary information.",
    tags: ["display", "text", "paragraph", "body", "copy"],
    schema: S.textSchema,
    Component: C.Text,
  }),
  defineBrick({
    name: "Badge",
    description: "A small pill label for statuses or tags, with default/success/warning/danger variants.",
    tags: ["display", "badge", "tag", "label", "status", "pill"],
    schema: S.badgeSchema,
    Component: C.Badge,
  }),
  defineBrick({
    name: "StatCard",
    description: "A KPI metric card showing a label, a large value, and an optional delta with up/down/flat trend.",
    tags: ["display", "metric", "kpi", "stat", "dashboard", "number"],
    schema: S.statCardSchema,
    Component: C.StatCard,
  }),
  defineBrick({
    name: "List",
    description: "An ordered or unordered bullet list of text items.",
    tags: ["display", "list", "bullets", "items"],
    schema: S.listSchema,
    Component: C.List,
  }),
  defineBrick({
    name: "Table",
    description: "A data table with header columns and string rows.",
    tags: ["display", "table", "data", "grid", "rows"],
    schema: S.tableSchema,
    Component: C.Table,
  }),
  defineBrick({
    name: "Avatar",
    description: "A circular user avatar showing an image or initials next to a name.",
    tags: ["display", "avatar", "user", "profile", "person"],
    schema: S.avatarSchema,
    Component: C.Avatar,
  }),
  defineBrick({
    name: "Image",
    description: "An image from a URL with alt text and optional rounded corners.",
    tags: ["display", "image", "picture", "media"],
    schema: S.imageSchema,
    Component: C.Image,
  }),
  defineBrick({
    name: "Tabs",
    description: "A tabbed panel switching between labelled text sections.",
    tags: ["display", "tabs", "navigation", "sections"],
    schema: S.tabsSchema,
    Component: C.Tabs,
  }),

  // --- Charts ---
  defineBrick({
    name: "BarChart",
    description: "A bar chart for comparing categorical values, e.g. monthly sales or counts per category.",
    tags: ["chart", "viz", "bar", "graph", "data", "comparison", "dashboard"],
    schema: S.barChartSchema,
    Component: C.BarChart,
  }),
  defineBrick({
    name: "LineChart",
    description: "A line chart for showing a trend over time or an ordered sequence.",
    tags: ["chart", "viz", "line", "trend", "time", "graph", "dashboard"],
    schema: S.lineChartSchema,
    Component: C.LineChart,
  }),
  defineBrick({
    name: "PieChart",
    description: "A pie chart for showing parts of a whole or proportional breakdowns.",
    tags: ["chart", "viz", "pie", "proportion", "breakdown", "share"],
    schema: S.pieChartSchema,
    Component: C.PieChart,
  }),

  // --- Form ---
  defineBrick({
    name: "Input",
    description: "A single-line text input with an optional label, for text/email/password/number.",
    tags: ["form", "input", "field", "text", "entry"],
    schema: S.inputSchema,
    Component: C.Input,
  }),
  defineBrick({
    name: "Select",
    description: "A dropdown select with an optional label and a list of options.",
    tags: ["form", "select", "dropdown", "options", "choice"],
    schema: S.selectSchema,
    Component: C.Select,
  }),
  defineBrick({
    name: "Checkbox",
    description: "A labelled checkbox toggle.",
    tags: ["form", "checkbox", "toggle", "boolean", "consent"],
    schema: S.checkboxSchema,
    Component: C.Checkbox,
  }),
  defineBrick({
    name: "FormField",
    description: "A labelled form-field wrapper with an optional hint that wraps an input control.",
    tags: ["form", "field", "label", "wrapper", "container"],
    schema: S.formFieldSchema,
    acceptsChildren: true,
    Component: C.FormField,
  }),
  defineBrick({
    name: "Stepper",
    description: "A horizontal step indicator showing progress through a multi-step flow.",
    tags: ["form", "stepper", "steps", "progress", "wizard", "flow"],
    schema: S.stepperSchema,
    Component: C.Stepper,
  }),
  defineBrick({
    name: "Button",
    description: "A clickable button with variant and size, for calls to action.",
    tags: ["form", "button", "action", "cta", "submit"],
    schema: S.buttonSchema,
    Component: C.Button,
  }),

  // --- Feedback ---
  defineBrick({
    name: "Alert",
    description: "A callout banner with a title and optional description, in info/success/warning/danger variants.",
    tags: ["feedback", "alert", "callout", "banner", "notice", "message"],
    schema: S.alertSchema,
    Component: C.Alert,
  }),
  defineBrick({
    name: "ProgressBar",
    description: "A horizontal progress bar showing a 0-100 percentage with an optional label.",
    tags: ["feedback", "progress", "bar", "percent", "completion"],
    schema: S.progressBarSchema,
    Component: C.ProgressBar,
  }),

  // --- Rich / embeds ---
  defineBrick({
    name: "Map",
    description: "An interactive OpenStreetMap with markers. Each marker takes a lat/lng, a label, and an optional popup that can be ANY brick (StatCard, chart, chat…), so other elements hook onto locations. Use for maps, store finders, venue/office locations, geo dashboards.",
    tags: ["map", "location", "geo", "place", "markers", "osm", "interactive"],
    schema: S.mapSchema,
    Component: MapBrick,
  }),
  defineBrick({
    name: "KeyValue",
    description: "A key/value detail list for showing labelled fields, specs, or metadata.",
    tags: ["display", "details", "key-value", "spec", "metadata", "fields"],
    schema: S.keyValueSchema,
    Component: C.KeyValue,
  }),
  defineBrick({
    name: "Timeline",
    description: "A vertical timeline of time-stamped events with titles and optional descriptions.",
    tags: ["display", "timeline", "events", "history", "activity", "log"],
    schema: S.timelineSchema,
    Component: C.Timeline,
  }),
  defineBrick({
    name: "Quote",
    description: "A styled blockquote with optional author, for testimonials or highlighted text.",
    tags: ["display", "quote", "testimonial", "blockquote", "highlight"],
    schema: S.quoteSchema,
    Component: C.Quote,
  }),
  defineBrick({
    name: "Animated",
    description: "Wraps children with a live animation: entrance (fade, slide-up, slide-down, zoom) or looping (pulse, bounce, spin). Use to make elements move when the user asks for animation.",
    tags: ["animation", "motion", "live", "transition", "effect", "wrapper"],
    schema: S.animatedSchema,
    acceptsChildren: true,
    Component: C.Animated,
  }),

  // --- Stateful / SPA ---
  defineBrick({
    name: "DataSource",
    description: "Polls a JSON HTTP endpoint on an interval and writes the result into a keyed store element, so bound bricks (charts/stats/tables with a matching bindKey) update live. Use to feed live data into a widget.",
    tags: ["data", "live", "fetch", "api", "polling", "state", "stream", "source"],
    schema: S.dataSourceSchema,
    Component: C.DataSource,
  }),
  defineBrick({
    name: "Screens",
    description: "A multi-screen SPA wrapper: a nav bar switches between full child compositions (one child per label, in order). Use to build multi-page apps with shared state.",
    tags: ["spa", "navigation", "screens", "router", "pages", "tabs", "app", "container"],
    schema: S.screensSchema,
    acceptsChildren: true,
    Component: C.Screens,
  }),
  defineBrick({
    name: "ActionButton",
    description: "A button that, when clicked, sets a value on a keyed store element — driving live updates to bound bricks. Use for interactivity (filters, toggles, navigation, refresh).",
    tags: ["action", "button", "interactive", "state", "trigger", "event", "message"],
    schema: S.actionButtonSchema,
    Component: C.ActionButton,
  }),

  // --- Collaborative / live ---
  defineBrick({
    name: "CollabText",
    description: "A shared text area edited collaboratively in real time — every connected user sees keystrokes merge live (CRDT). Use for shared notes, docs, or co-authored content.",
    tags: ["collaborative", "realtime", "text", "editor", "shared", "multiplayer", "notes"],
    schema: S.collabTextSchema,
    Component: CC.CollabText,
  }),
  defineBrick({
    name: "CollabChat",
    description: "A shared chat box — anyone viewing the widget can post messages and everyone sees them live. Use for shareable chat or comments.",
    tags: ["collaborative", "realtime", "chat", "messages", "shared", "multiplayer", "comments"],
    schema: S.collabChatSchema,
    Component: CC.CollabChat,
  }),
  defineBrick({
    name: "LiveFeed",
    description: "A live-updating metric with a sparkline, fed by a server SSE stream. Use to show real-time server-pushed values for demos.",
    tags: ["live", "realtime", "sse", "metric", "stream", "sparkline", "monitoring", "demo"],
    schema: S.liveFeedSchema,
    Component: CC.LiveFeed,
  }),
  defineBrick({
    name: "CryptoChart",
    description: "A LIVE cryptocurrency price chart streaming real prices from Coinbase (WebSocket). Shows current price, 24h change, and a live line chart. Use for fintech/crypto/markets dashboards. Products like BTC-USD, ETH-USD, SOL-USD.",
    tags: ["live", "realtime", "crypto", "fintech", "finance", "price", "markets", "coinbase", "chart", "bitcoin"],
    schema: S.cryptoChartSchema,
    Component: C.CryptoChart,
  }),
];
