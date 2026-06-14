import { describe, it, expect, beforeEach } from "vitest";
import { useSelectionStore } from "./selectionStore";

const reset = () =>
  useSelectionStore.setState({ selectedId: null, editingId: null, hoverId: null, outlineAll: false });

describe("selectionStore", () => {
  beforeEach(reset);

  it("select sets selectedId and clears editing", () => {
    useSelectionStore.getState().enterEdit("a");
    useSelectionStore.getState().select("b");
    expect(useSelectionStore.getState().selectedId).toBe("b");
    expect(useSelectionStore.getState().editingId).toBeNull();
  });

  it("enterEdit sets both selected + editing", () => {
    useSelectionStore.getState().enterEdit("a");
    expect(useSelectionStore.getState().selectedId).toBe("a");
    expect(useSelectionStore.getState().editingId).toBe("a");
  });

  it("exitEdit keeps the selection", () => {
    useSelectionStore.getState().enterEdit("a");
    useSelectionStore.getState().exitEdit();
    expect(useSelectionStore.getState().selectedId).toBe("a");
    expect(useSelectionStore.getState().editingId).toBeNull();
  });

  it("clear resets selection + editing", () => {
    useSelectionStore.getState().enterEdit("a");
    useSelectionStore.getState().clear();
    expect(useSelectionStore.getState().selectedId).toBeNull();
    expect(useSelectionStore.getState().editingId).toBeNull();
  });

  it("hover + outlineAll are independent toggles", () => {
    useSelectionStore.getState().setHover("h");
    expect(useSelectionStore.getState().hoverId).toBe("h");
    useSelectionStore.getState().toggleOutlineAll();
    expect(useSelectionStore.getState().outlineAll).toBe(true);
    expect(useSelectionStore.getState().hoverId).toBe("h"); // unaffected
  });
});
