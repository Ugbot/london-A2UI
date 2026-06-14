import { describe, it, expect } from "vitest";
import {
  ensureIds,
  indexElements,
  findById,
  patchById,
  removeById,
  duplicateById,
  insertChild,
  moveNode,
  reparentNode,
  findParent,
  replaceById,
  labelOf,
} from "./tree";
import type { CompositionNode } from "./composition";

describe("reparentNode (nesting drop) + findParent", () => {
  const make = (): CompositionNode =>
    ensureIds({
      brick: "Stack",
      props: {},
      id: "root",
      children: [
        { brick: "Text", props: { text: "a" }, id: "a" },
        { brick: "Text", props: { text: "b" }, id: "b" },
        { brick: "Card", props: {}, id: "c", children: [{ brick: "Text", props: { text: "d" }, id: "d" }] },
      ],
    });
  const ids = (n: CompositionNode | null | undefined) => (n?.children ?? []).map((c) => c.id);

  it("findParent returns the container of a node", () => {
    expect(findParent(make(), "d")?.id).toBe("c");
    expect(findParent(make(), "a")?.id).toBe("root");
    expect(findParent(make(), "root")).toBeNull();
  });

  it("moves a node INTO another container at an index", () => {
    const r = reparentNode(make(), "a", "c", 0); // a → first child of Card c
    expect(ids(r)).toEqual(["b", "c"]); // a left the root
    expect(ids(findById(r, "c"))).toEqual(["a", "d"]); // a is now inside c, before d
  });

  it("reorders within the same parent (adjusts index for the removal shift)", () => {
    expect(ids(reparentNode(make(), "a", "root", 2))).toEqual(["b", "a", "c"]); // before c
    expect(ids(reparentNode(make(), "a", "root", 3))).toEqual(["b", "c", "a"]); // append
  });

  it("guards: can't nest a node into its own descendant, or move the root", () => {
    expect(ids(reparentNode(make(), "c", "d", 0))).toEqual(ids(make())); // c contains d
    expect(reparentNode(make(), "root", "c", 0).id).toBe("root");
  });
});

describe("moveNode (drag-to-rearrange)", () => {
  const make = (): CompositionNode =>
    ensureIds({
      brick: "Stack",
      props: {},
      children: [
        { brick: "Text", props: { text: "a" }, id: "a" },
        { brick: "Text", props: { text: "b" }, id: "b" },
        { brick: "Card", props: {}, id: "c", children: [{ brick: "Text", props: { text: "d" }, id: "d" }] },
      ],
    });

  const order = (n: CompositionNode) => (n.children ?? []).map((c) => c.id);

  it("reorders siblings (move b before a)", () => {
    const r = moveNode(make(), "b", "a");
    expect(order(r)).toEqual(["b", "a", "c"]);
  });

  it("supports position 'after' (move a after b)", () => {
    const r = moveNode(make(), "a", "b", "after");
    expect(order(r)).toEqual(["b", "a", "c"]);
  });

  it("replaceById swaps a node for a new subtree (e.g. wireframe → real bricks)", () => {
    const replacement: CompositionNode = {
      brick: "Card",
      id: "real",
      props: {},
      children: [{ brick: "Heading", props: { text: "Done" }, id: "h" }],
    };
    const r = replaceById(make(), "a", replacement);
    expect(order(r)).toEqual(["real", "b", "c"]);
    expect(findById(r, "h")?.brick).toBe("Heading");
  });

  it("reparents a node before a target in another container (move a before d)", () => {
    const r = moveNode(make(), "a", "d");
    expect(order(r)).toEqual(["b", "c"]); // a left the root
    expect((findById(r, "c")!.children ?? []).map((x) => x.id)).toEqual(["a", "d"]);
  });

  it("is a no-op when moving a node into its own descendant", () => {
    const r = moveNode(make(), "c", "d"); // c contains d
    expect(order(r)).toEqual(["a", "b", "c"]);
  });

  it("is a no-op for the root, unknown ids, or self-move", () => {
    const t = make();
    expect(order(moveNode(t, "stack-1", "a"))).toEqual(order(t)); // root id from ensureIds
    expect(order(moveNode(t, "nope", "a"))).toEqual(order(t));
    expect(order(moveNode(t, "a", "a"))).toEqual(order(t));
  });
});

/** Build a random-ish tree for property checks (deterministic seed via index). */
function randomTree(seed: number): CompositionNode {
  const bricks = ["Stack", "Grid", "Card", "StatCard", "Text", "BarChart"];
  let counter = 0;
  const make = (depth: number): CompositionNode => {
    const brick = bricks[(seed + counter++) % bricks.length];
    const node: CompositionNode = { brick, props: { n: counter } };
    const kids = depth > 0 ? (seed + counter) % 3 : 0;
    if (kids > 0) node.children = Array.from({ length: kids }, () => make(depth - 1));
    return node;
  };
  return make(3);
}

describe("ensureIds", () => {
  it("assigns a unique id to every node", () => {
    for (let s = 0; s < 25; s++) {
      const tree = ensureIds(randomTree(s));
      const ids = indexElements(tree).map((e) => e.id);
      const count = (function countNodes(n: CompositionNode): number {
        return 1 + (n.children ?? []).reduce((a, c) => a + countNodes(c), 0);
      })(tree);
      expect(ids.length).toBe(count); // every node indexed
      expect(new Set(ids).size).toBe(ids.length); // all unique
    }
  });

  it("preserves existing ids", () => {
    const tree: CompositionNode = {
      brick: "Stack",
      id: "keep-me",
      props: {},
      children: [{ brick: "Text", props: { text: "x" } }],
    };
    const out = ensureIds(tree);
    expect(out.id).toBe("keep-me");
    expect(out.children![0].id).toBeTruthy();
  });
});

describe("findById / patchById", () => {
  const tree = ensureIds({
    brick: "Stack",
    props: {},
    children: [
      { brick: "StatCard", id: "stat", props: { label: "Rev", value: "10" } },
      { brick: "BarChart", id: "chart", props: { data: [{ label: "a", value: 1 }], color: "#000" } },
    ],
  });

  it("finds a node by id", () => {
    expect(findById(tree, "stat")?.brick).toBe("StatCard");
    expect(findById(tree, "nope")).toBeNull();
  });

  it("merges props without dropping others", () => {
    const next = patchById(tree, "stat", { setProps: { value: "99" } });
    const stat = findById(next, "stat")!;
    expect(stat.props.value).toBe("99");
    expect(stat.props.label).toBe("Rev"); // untouched
    // immutability: original unchanged
    expect(findById(tree, "stat")!.props.value).toBe("10");
  });

  it("swaps the brick type but keeps props", () => {
    const next = patchById(tree, "chart", { brick: "CandlestickChart" });
    const c = findById(next, "chart")!;
    expect(c.brick).toBe("CandlestickChart");
    expect(c.props.color).toBe("#000");
  });
});

describe("removeById / duplicateById / insertChild", () => {
  const base = ensureIds({
    brick: "Grid",
    id: "grid",
    props: {},
    children: [
      { brick: "Text", id: "t1", props: { text: "a" } },
      { brick: "Text", id: "t2", props: { text: "b" } },
    ],
  });

  it("removes a node by id", () => {
    const next = removeById(base, "t1")!;
    expect(indexElements(next).map((e) => e.id)).not.toContain("t1");
    expect(indexElements(next).map((e) => e.id)).toContain("t2");
  });

  it("removing the root returns null", () => {
    expect(removeById(base, "grid")).toBeNull();
  });

  it("duplicates a node as a fresh-id sibling", () => {
    const next = duplicateById(base, "t1");
    const ids = indexElements(next).map((e) => e.id);
    expect(ids.filter((id) => id.startsWith("t1")).length).toBe(2); // t1 + t1-copy
    expect(new Set(ids).size).toBe(ids.length); // still unique
    expect(next.children!.length).toBe(3);
  });

  it("inserts a child under a parent at an index", () => {
    const next = insertChild(base, "grid", { brick: "Badge", id: "b", props: { text: "new" } }, 1);
    expect(next.children!.map((c) => c.id)).toEqual(["t1", "b", "t2"]);
  });
});

describe("labelOf", () => {
  it("prefers title/label/text over brick name", () => {
    expect(labelOf({ brick: "Card", props: { title: "Sales" } })).toBe("Sales");
    expect(labelOf({ brick: "StatCard", props: { label: "Revenue" } })).toBe("Revenue");
    expect(labelOf({ brick: "BarChart", props: {} })).toBe("BarChart");
  });
});
