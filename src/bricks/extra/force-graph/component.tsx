"use client";

/**
 * A D3 force-directed network graph — a general, physics-driven visualization
 * (draggable nodes, link forces) beyond what the chart bricks offer. D3 is
 * imperative (it mutates an SVG), so we drive it inside a useEffect against a
 * ref and re-run when the data changes.
 */
import * as React from "react";
import * as d3 from "d3";
import { useElementData } from "@/state/hooks";
import type { ForceGraphProps } from "./schema";

const PALETTE = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899"];

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label?: string;
  group?: number;
}
interface SimLink {
  source: string;
  target: string;
  value?: number;
}

export function ForceGraph({ nodes, links, height, bindKey }: ForceGraphProps) {
  const live = useElementData<{ nodes?: ForceGraphProps["nodes"]; links?: ForceGraphProps["links"] } | undefined>(
    bindKey,
    undefined,
  );
  const data = {
    nodes: live?.nodes ?? nodes,
    links: live?.links ?? links,
  };
  const ref = React.useRef<SVGSVGElement>(null);

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const width = el.clientWidth || 600;

    const simNodes: SimNode[] = data.nodes.map((n) => ({ ...n }));
    const simLinks: SimLink[] = data.links.map((l) => ({ ...l }));

    const svg = d3.select(el);
    svg.selectAll("*").remove();
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const sim = d3
      .forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        d3.forceLink<SimNode, d3.SimulationLinkDatum<SimNode>>(simLinks as unknown as d3.SimulationLinkDatum<SimNode>[])
          .id((d) => (d as SimNode).id)
          .distance(70),
      )
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide(22));

    const link = svg
      .append("g")
      .attr("stroke", "var(--border)")
      .attr("stroke-width", 1.5)
      .selectAll("line")
      .data(simLinks)
      .join("line");

    const node = svg
      .append("g")
      .selectAll<SVGGElement, SimNode>("g")
      .data(simNodes)
      .join("g")
      .style("cursor", "grab");

    node
      .append("circle")
      .attr("r", 14)
      .attr("fill", (d) => PALETTE[(d.group ?? 0) % PALETTE.length])
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d) => d.label ?? d.id)
      .attr("x", 18)
      .attr("y", 4)
      .attr("font-size", 12)
      .attr("fill", "var(--foreground)");

    node.call(
      d3
        .drag<SVGGElement, SimNode>()
        .on("start", (event, d) => {
          if (!event.active) sim.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) sim.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }),
    );

    sim.on("tick", () => {
      link
        .attr("x1", (d) => (d.source as unknown as SimNode).x ?? 0)
        .attr("y1", (d) => (d.source as unknown as SimNode).y ?? 0)
        .attr("x2", (d) => (d.target as unknown as SimNode).x ?? 0)
        .attr("y2", (d) => (d.target as unknown as SimNode).y ?? 0);
      node.attr("transform", (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      sim.stop();
    };
  }, [data.nodes, data.links, height]);

  return (
    <div
      className="overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)]"
      style={{ height }}
    >
      <svg ref={ref} width="100%" height="100%" />
    </div>
  );
}
