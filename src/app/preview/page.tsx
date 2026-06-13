"use client";

/**
 * M1 verification page — renders a static composition tree exercising most
 * bricks, with no agent involved. Confirms the registry + recursive renderer
 * assemble correctly in the browser. Visit /preview.
 */
import { useState } from "react";
import { WidgetCanvas } from "@/components/WidgetCanvas";
import type { CompositionNode } from "@/bricks/composition";
import type { RenderStatus } from "@/lib/types";

const SAMPLE: CompositionNode = {
  brick: "Stack",
  props: { gap: 6 },
  children: [
    { brick: "Heading", props: { text: "Acme Sales Dashboard", level: 1 } },
    { brick: "Text", props: { text: "Q3 performance overview, assembled entirely from bricks.", muted: true } },
    {
      brick: "Grid",
      props: { cols: 3, gap: 4 },
      children: [
        { brick: "StatCard", props: { label: "Revenue", value: "$1.24M", delta: "12.4% vs Q2", trend: "up" } },
        { brick: "StatCard", props: { label: "Active Users", value: "8,932", delta: "3.1%", trend: "up" } },
        { brick: "StatCard", props: { label: "Churn", value: "2.1%", delta: "0.4%", trend: "down" } },
      ],
    },
    {
      brick: "Card",
      props: { title: "Monthly Sales", description: "Revenue by month ($k)" },
      children: [
        {
          brick: "BarChart",
          props: {
            data: [
              { label: "Apr", value: 320 },
              { label: "May", value: 410 },
              { label: "Jun", value: 510 },
              { label: "Jul", value: 470 },
              { label: "Aug", value: 590 },
            ],
            color: "#6366f1",
          },
        },
      ],
    },
    {
      brick: "Grid",
      props: { cols: 2, gap: 4 },
      children: [
        {
          brick: "Card",
          props: { title: "Signups Trend" },
          children: [
            {
              brick: "LineChart",
              props: {
                data: [
                  { label: "W1", value: 120 },
                  { label: "W2", value: 180 },
                  { label: "W3", value: 160 },
                  { label: "W4", value: 240 },
                ],
                color: "#22c55e",
              },
            },
          ],
        },
        {
          brick: "Card",
          props: { title: "Revenue by Channel" },
          children: [
            {
              brick: "PieChart",
              props: {
                data: [
                  { label: "Direct", value: 45 },
                  { label: "Referral", value: 25 },
                  { label: "Organic", value: 20 },
                  { label: "Paid", value: 10 },
                ],
              },
            },
          ],
        },
      ],
    },
    {
      brick: "Section",
      props: { title: "Top Accounts", description: "Highest revenue this quarter" },
      children: [
        {
          brick: "Table",
          props: {
            columns: ["Account", "Plan", "MRR"],
            rows: [
              ["Globex", "Enterprise", "$42k"],
              ["Initech", "Growth", "$18k"],
              ["Umbrella", "Growth", "$15k"],
            ],
          },
        },
      ],
    },
    {
      brick: "Section",
      props: { title: "Request a Demo" },
      children: [
        {
          brick: "Stack",
          props: { gap: 3 },
          children: [
            { brick: "Stepper", props: { steps: ["Details", "Team", "Confirm"], current: 1 } },
            { brick: "Input", props: { label: "Work email", placeholder: "you@company.com", type: "email" } },
            { brick: "Select", props: { label: "Team size", options: ["1-10", "11-50", "51-200", "200+"] } },
            { brick: "Checkbox", props: { label: "Subscribe to product updates", checked: true } },
            { brick: "ProgressBar", props: { value: 66, label: "Profile completeness" } },
            { brick: "Button", props: { label: "Book demo", variant: "default" } },
          ],
        },
      ],
    },
    { brick: "Divider", props: { label: "status" } },
    {
      brick: "Grid",
      props: { cols: 2, gap: 4 },
      children: [
        { brick: "Alert", props: { title: "All systems operational", description: "No incidents in the last 24h.", variant: "success" } },
        { brick: "Tabs", props: { tabs: [{ label: "Overview", content: "Everything composed from ~25 bricks." }, { label: "Details", content: "Each brick is Zod-validated before render." }] } },
      ],
    },
  ],
};

export default function PreviewPage() {
  const [status, setStatus] = useState<RenderStatus | null>(null);
  return (
    <div className="flex h-screen flex-col">
      <div className="border-b border-[var(--border)] bg-[var(--muted)] px-6 py-2 text-xs">
        Renderer status:{" "}
        {status === null ? "…" : status.ok ? (
          <span className="text-emerald-600">ok</span>
        ) : (
          <span className="text-red-600">
            {status.stage} error ({status.errors.length})
          </span>
        )}
      </div>
      <div className="flex-1 overflow-hidden">
        <WidgetCanvas tree={SAMPLE} onStatus={setStatus} />
      </div>
    </div>
  );
}
