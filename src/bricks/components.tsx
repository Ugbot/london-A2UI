"use client";

/**
 * React implementations for every brick. Props are validated against the Zod
 * schemas in `schemas.ts` before these render, so each component trusts its
 * inputs. Prop TYPES are imported (type-only) from `schemas.ts` to keep a
 * single source of truth without poisoning the server/client boundary.
 */
import * as React from "react";
import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RLineChart,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  Card as UICard,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button as UIButton } from "@/components/ui/button";
import type {
  AlertProps,
  AnimatedProps,
  AvatarProps,
  BadgeProps,
  BarChartProps,
  ButtonBrickProps,
  CardProps,
  CheckboxProps,
  CryptoChartProps,
  DividerProps,
  FormFieldProps,
  GridProps,
  HeadingProps,
  ImageProps,
  InputProps,
  KeyValueProps,
  LineChartProps,
  ListProps,
  PieChartProps,
  ProgressBarProps,
  QuoteProps,
  SectionProps,
  SelectProps,
  StackProps,
  StatCardProps,
  StepperProps,
  TableProps,
  TabsProps,
  TextProps,
  TimelineProps,
} from "./schemas";

type WithChildren<P> = P & { children?: React.ReactNode };

const GAP: Record<number, string> = {
  0: "gap-0", 1: "gap-1", 2: "gap-2", 3: "gap-3", 4: "gap-4",
  5: "gap-5", 6: "gap-6", 8: "gap-8", 10: "gap-10", 12: "gap-12",
};
const COLS: Record<number, string> = {
  1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3",
  4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6",
};
const CHART_PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7"];

// --- Layout ---
export function Stack({ direction, gap, align, justify, children }: WithChildren<StackProps>) {
  return (
    <div
      className={cn(
        "flex",
        direction === "horizontal" ? "flex-row" : "flex-col",
        GAP[gap] ?? "gap-4",
        { start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch" }[align],
        { start: "justify-start", center: "justify-center", end: "justify-end", between: "justify-between" }[justify],
      )}
    >
      {children}
    </div>
  );
}

export function Grid({ cols, gap, children }: WithChildren<GridProps>) {
  return <div className={cn("grid", COLS[cols] ?? "grid-cols-2", GAP[gap] ?? "gap-4")}>{children}</div>;
}

export function Section({ title, description, children }: WithChildren<SectionProps>) {
  return (
    <section className="flex flex-col gap-3">
      {(title || description) && (
        <header className="flex flex-col gap-1">
          {title && <h2 className="text-xl font-semibold tracking-tight">{title}</h2>}
          {description && <p className="text-sm text-[var(--muted-foreground)]">{description}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Card({ title, description, footer, children }: WithChildren<CardProps>) {
  return (
    <UICard>
      {(title || description) && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
      )}
      <CardContent className={cn("flex flex-col gap-3", !title && !description && "pt-6")}>
        {children}
      </CardContent>
      {footer && <CardFooter className="text-sm text-[var(--muted-foreground)]">{footer}</CardFooter>}
    </UICard>
  );
}

export function Divider({ label }: DividerProps) {
  if (!label) return <hr className="border-[var(--border)]" />;
  return (
    <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
      <hr className="flex-1 border-[var(--border)]" />
      <span>{label}</span>
      <hr className="flex-1 border-[var(--border)]" />
    </div>
  );
}

// --- Display ---
export function Heading({ text, level }: HeadingProps) {
  const Tag = (["h1", "h2", "h3", "h4"][level - 1] ?? "h2") as keyof React.JSX.IntrinsicElements;
  const size = ["text-3xl", "text-2xl", "text-xl", "text-lg"][level - 1] ?? "text-2xl";
  return <Tag className={cn("font-semibold tracking-tight", size)}>{text}</Tag>;
}

export function Text({ text, muted }: TextProps) {
  return <p className={cn("text-sm leading-relaxed", muted && "text-[var(--muted-foreground)]")}>{text}</p>;
}

export function Badge({ text, variant }: BadgeProps) {
  const styles: Record<BadgeProps["variant"], string> = {
    default: "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
  };
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-medium", styles[variant])}>
      {text}
    </span>
  );
}

export function StatCard({ label, value, delta, trend }: StatCardProps) {
  const trendColor = { up: "text-emerald-600", down: "text-red-600", flat: "text-[var(--muted-foreground)]" }[trend];
  const arrow = { up: "▲", down: "▼", flat: "→" }[trend];
  return (
    <UICard>
      <CardContent className="flex flex-col gap-1 p-5">
        <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        {delta && <span className={cn("text-xs font-medium", trendColor)}>{arrow} {delta}</span>}
      </CardContent>
    </UICard>
  );
}

export function List({ items, ordered }: ListProps) {
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={cn("flex flex-col gap-1 text-sm", ordered ? "list-decimal pl-5" : "list-disc pl-5")}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </Tag>
  );
}

export function Table({ columns, rows }: TableProps) {
  const [sort, setSort] = React.useState<{ col: number; dir: 1 | -1 } | null>(null);

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const { col, dir } = sort;
    // Numeric-aware comparison (handles "$1,200", "12%", plain text).
    const num = (s: string) => {
      const n = parseFloat(String(s).replace(/[^0-9.-]/g, ""));
      return Number.isNaN(n) ? null : n;
    };
    return [...rows].sort((a, b) => {
      const av = a[col] ?? "";
      const bv = b[col] ?? "";
      const an = num(av);
      const bn = num(bv);
      const cmp = an !== null && bn !== null ? an - bn : String(av).localeCompare(String(bv));
      return cmp * dir;
    });
  }, [rows, sort]);

  const toggle = (col: number) =>
    setSort((prev) =>
      prev && prev.col === col ? { col, dir: prev.dir === 1 ? -1 : 1 } : { col, dir: 1 },
    );

  return (
    <div className="overflow-x-auto rounded-[var(--radius)] border border-[var(--border)]">
      <table className="w-full text-left text-sm">
        <thead className="bg-[var(--muted)] text-[var(--muted-foreground)]">
          <tr>
            {columns.map((c, i) => (
              <th key={i} className="px-3 py-2 font-medium">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  className="flex items-center gap-1 hover:text-[var(--foreground)]"
                >
                  {c}
                  <span className="text-[10px]">
                    {sort?.col === i ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, ri) => (
            <tr key={ri} className="border-t border-[var(--border)]">
              {row.map((cell, ci) => (
                <td key={ci} className="px-3 py-2">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Avatar({ name, src }: AvatarProps) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-2">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-9 w-9 rounded-full object-cover" />
      ) : (
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--secondary)] text-xs font-medium text-[var(--secondary-foreground)]">
          {initials}
        </span>
      )}
      <span className="text-sm font-medium">{name}</span>
    </div>
  );
}

export function Image({ src, alt, rounded }: ImageProps) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} className={cn("max-w-full object-cover", rounded && "rounded-[var(--radius)]")} />;
}

export function Tabs({ tabs }: TabsProps) {
  const [active, setActive] = React.useState(0);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((t, i) => (
          <button
            key={i}
            onClick={() => setActive(i)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              i === active
                ? "border-[var(--primary)] text-[var(--foreground)]"
                : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm leading-relaxed">{tabs[active]?.content}</p>
    </div>
  );
}

// --- Charts ---
function ChartFrame({ children }: { children: React.ReactElement }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function BarChart({ data, color }: BarChartProps) {
  return (
    <ChartFrame>
      <RBarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" fontSize={12} stroke="var(--muted-foreground)" />
        <YAxis fontSize={12} stroke="var(--muted-foreground)" />
        <Tooltip />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </RBarChart>
    </ChartFrame>
  );
}

export function LineChart({ data, color }: LineChartProps) {
  return (
    <ChartFrame>
      <RLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" fontSize={12} stroke="var(--muted-foreground)" />
        <YAxis fontSize={12} stroke="var(--muted-foreground)" />
        <Tooltip />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={false} />
      </RLineChart>
    </ChartFrame>
  );
}

export function PieChart({ data }: PieChartProps) {
  return (
    <ChartFrame>
      <RPieChart>
        <Pie data={data} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={90} label>
          {data.map((_, i) => (
            <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </RPieChart>
    </ChartFrame>
  );
}

export function CryptoChart({ product, label }: CryptoChartProps) {
  const [history, setHistory] = React.useState<{ t: number; price: number }[]>([]);
  const [price, setPrice] = React.useState<number | null>(null);
  const [open24h, setOpen24h] = React.useState<number | null>(null);
  const [state, setState] = React.useState<"connecting" | "live" | "error">("connecting");

  React.useEffect(() => {
    setHistory([]);
    setPrice(null);
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket("wss://ws-feed.exchange.coinbase.com");
      ws.onopen = () =>
        ws?.send(JSON.stringify({ type: "subscribe", product_ids: [product], channels: ["ticker"] }));
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data) as { type?: string; price?: string; open_24h?: string };
          if (m.type === "ticker" && m.price) {
            const p = parseFloat(m.price);
            setPrice(p);
            if (m.open_24h) setOpen24h(parseFloat(m.open_24h));
            setState("live");
            setHistory((h) => [...h.slice(-59), { t: Date.now(), price: p }]);
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onerror = () => setState("error");
    } catch {
      setState("error");
    }
    return () => {
      try {
        ws?.close();
      } catch {
        /* noop */
      }
    };
  }, [product]);

  const changePct = price !== null && open24h ? ((price - open24h) / open24h) * 100 : null;
  const up = (changePct ?? 0) >= 0;
  const color = up ? "#16a34a" : "#dc2626";
  const fmt = (n: number) =>
    n.toLocaleString(undefined, { maximumFractionDigits: n < 10 ? 4 : 2 });

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius)] border border-[var(--border)] p-4">
      <div className="flex items-baseline justify-between">
        <div className="flex flex-col">
          <span className="text-sm font-medium">{label ?? product}</span>
          <span className="text-xs text-[var(--muted-foreground)]">Coinbase · {product}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-2xl font-semibold tabular-nums">
            {price !== null ? `$${fmt(price)}` : state === "error" ? "—" : "…"}
          </span>
          {changePct !== null && (
            <span className="text-xs font-medium tabular-nums" style={{ color }}>
              {up ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}% (24h)
            </span>
          )}
        </div>
      </div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <RLineChart data={history}>
            <YAxis domain={["dataMin", "dataMax"]} hide />
            <Tooltip
              formatter={(v) => [`$${fmt(Number(v))}`, product]}
              labelFormatter={() => ""}
            />
            <Line type="monotone" dataKey="price" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
          </RLineChart>
        </ResponsiveContainer>
      </div>
      <span className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
        <span className={cn("inline-block h-1.5 w-1.5 rounded-full", state === "live" ? "bg-emerald-500" : state === "error" ? "bg-red-500" : "bg-amber-500")} />
        {state === "live" ? "live via Coinbase WebSocket" : state === "error" ? "connection error" : "connecting…"}
      </span>
    </div>
  );
}

// --- Rich / embeds (the interactive Map brick lives in ./map-components,
//     loaded client-only via next/dynamic because Leaflet needs `window`) ---
export function KeyValue({ items }: KeyValueProps) {
  return (
    <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
      {items.map((it, i) => (
        <React.Fragment key={i}>
          <dt className="text-[var(--muted-foreground)]">{it.key}</dt>
          <dd className="font-medium">{it.value}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

export function Timeline({ items }: TimelineProps) {
  return (
    <ol className="flex flex-col gap-4 border-l border-[var(--border)] pl-4">
      {items.map((it, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
          <div className="text-xs text-[var(--muted-foreground)]">{it.time}</div>
          <div className="text-sm font-medium">{it.title}</div>
          {it.description && <div className="text-sm text-[var(--muted-foreground)]">{it.description}</div>}
        </li>
      ))}
    </ol>
  );
}

export function Quote({ text, author }: QuoteProps) {
  return (
    <blockquote className="border-l-4 border-[var(--primary)] pl-4 italic text-[var(--foreground)]">
      “{text}”
      {author && <footer className="mt-1 text-sm not-italic text-[var(--muted-foreground)]">— {author}</footer>}
    </blockquote>
  );
}

const LOOP_CLASS: Record<string, string> = {
  pulse: "animate-pulse",
  bounce: "animate-bounce",
  spin: "animate-spin",
};
const ENTRANCE_KEYFRAME: Record<string, string> = {
  fade: "brick-fade",
  "slide-up": "brick-slide-up",
  "slide-down": "brick-slide-down",
  zoom: "brick-zoom",
};

export function Animated({ animation, duration, loop, children }: WithChildren<AnimatedProps>) {
  // Looping animations (pulse/bounce/spin) use Tailwind utilities; entrance
  // animations (fade/slide/zoom) run once via our keyframes.
  if (LOOP_CLASS[animation]) {
    return <div className={LOOP_CLASS[animation]}>{children}</div>;
  }
  const keyframe = ENTRANCE_KEYFRAME[animation] ?? "brick-fade";
  return (
    <div
      style={{
        animationName: keyframe,
        animationDuration: `${duration}s`,
        animationIterationCount: loop ? "infinite" : 1,
        animationFillMode: "both",
        animationTimingFunction: "ease",
        ...(loop ? { animationDirection: "alternate" } : {}),
      }}
    >
      {children}
    </div>
  );
}

// --- Form ---
export function Input({ label, placeholder, type }: InputProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium">{label}</span>}
      <input
        type={type}
        placeholder={placeholder}
        className="h-9 rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
      />
    </label>
  );
}

export function Select({ label, options }: SelectProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium">{label}</span>}
      <select className="h-9 rounded-[var(--radius)] border border-[var(--input)] bg-[var(--background)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]">
        {options.map((o, i) => (
          <option key={i} value={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

export function Checkbox({ label, checked }: CheckboxProps) {
  const [value, setValue] = React.useState(checked);
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={value} onChange={(e) => setValue(e.target.checked)} className="h-4 w-4 rounded border-[var(--input)]" />
      <span>{label}</span>
    </label>
  );
}

export function FormField({ label, hint, children }: WithChildren<FormFieldProps>) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-[var(--muted-foreground)]">{hint}</span>}
    </div>
  );
}

export function Stepper({ steps, current }: StepperProps) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((step, i) => (
        <li key={i} className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
              i <= current ? "bg-[var(--primary)] text-[var(--primary-foreground)]" : "bg-[var(--secondary)] text-[var(--secondary-foreground)]",
            )}
          >
            {i + 1}
          </span>
          <span className={cn("text-sm", i === current ? "font-medium" : "text-[var(--muted-foreground)]")}>{step}</span>
          {i < steps.length - 1 && <span className="mx-1 h-px w-6 bg-[var(--border)]" />}
        </li>
      ))}
    </ol>
  );
}

export function Button({ label, variant, size }: ButtonBrickProps) {
  return <UIButton variant={variant} size={size}>{label}</UIButton>;
}

// --- Feedback ---
export function Alert({ title, description, variant }: AlertProps) {
  const styles: Record<AlertProps["variant"], string> = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={cn("rounded-[var(--radius)] border p-3 text-sm", styles[variant])}>
      <p className="font-medium">{title}</p>
      {description && <p className="mt-0.5 opacity-90">{description}</p>}
    </div>
  );
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <div className="flex justify-between text-xs text-[var(--muted-foreground)]">
          <span>{label}</span>
          <span>{value}%</span>
        </div>
      )}
      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--secondary)]">
        <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
