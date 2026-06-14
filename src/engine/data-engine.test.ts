import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as Y from "yjs";
import { doFetch, runDataCommand, stopPoll, statusKey, errorKey } from "./data-engine";
import { applyDataAction, readData } from "@/collab/doc-model";

function jsonRes(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body } as unknown as Response;
}

let doc: Y.Doc;
beforeEach(() => {
  doc = new Y.Doc();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("data-engine: fetch", () => {
  it("proxy fetch writes jsonPath-picked data + live status", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ ok: true, status: 200, data: { items: [1, 2] } }));
    vi.stubGlobal("fetch", fetchMock);

    await doFetch(doc, {
      key: "ds",
      source: { mode: "proxy", connectionId: "c", endpointId: "e" },
      jsonPath: "items",
    });

    expect(readData(doc, "ds")).toEqual([1, 2]);
    expect(readData(doc, statusKey("ds"))).toBe("live");
    // posted to the server proxy with the connection ids
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ connectionId: "c", endpointId: "e" });
  });

  it("direct mode fetches the url and applies a mortar transform", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ n: 5 })));
    await doFetch(doc, {
      key: "v",
      source: { mode: "direct", url: "https://example.com/x" },
      transform: "export default (d) => d.n * 2;",
    });
    expect(readData(doc, "v")).toBe(10);
  });

  it("records error status + message on failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes({ ok: false, status: 502, error: "upstream down" })));
    await doFetch(doc, { key: "bad", source: { mode: "proxy", connectionId: "c" } });
    expect(readData(doc, statusKey("bad"))).toBe("error");
    expect(readData(doc, errorKey("bad"))).toBe("upstream down");
  });

  it("dedupes concurrent identical fetches", async () => {
    let resolve!: (v: Response) => void;
    const fetchMock = vi.fn(() => new Promise<Response>((r) => (resolve = r)));
    vi.stubGlobal("fetch", fetchMock);

    const cfg = { key: "d", source: { mode: "proxy" as const, connectionId: "c" } };
    const p1 = doFetch(doc, cfg);
    const p2 = doFetch(doc, cfg); // same signature, in flight → collapsed
    resolve(jsonRes({ ok: true, status: 200, data: 1 }));
    await Promise.all([p1, p2]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(readData(doc, "d")).toBe(1);
  });
});

describe("data-engine: polling", () => {
  it("poll-start fetches immediately then on interval; poll-stop ends it", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => jsonRes({ ok: true, status: 200, data: Math.floor(123) }));
    vi.stubGlobal("fetch", fetchMock);

    runDataCommand(doc, {
      type: "data/poll-start",
      key: "p",
      source: { mode: "proxy", connectionId: "c" },
      intervalMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(0); // flush the immediate fetch
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1000);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    stopPoll(doc, "p");
    await vi.advanceTimersByTimeAsync(3000);
    expect(fetchMock).toHaveBeenCalledTimes(2); // no further polls
  });
});

describe("data-engine: form submit", () => {
  it("assembles bound fields, posts, and writes the response", async () => {
    const fetchMock = vi.fn(async () => jsonRes({ ok: true, status: 200, data: { id: 7 } }));
    vi.stubGlobal("fetch", fetchMock);

    applyDataAction(doc, { action: "set", target: "form.new.title", value: "Hi" });
    applyDataAction(doc, { action: "set", target: "form.new.count", value: 3 });

    await runDataCommand(doc, {
      type: "form/submit",
      source: { mode: "proxy", connectionId: "c", endpointId: "create" },
      fieldsPrefix: "form.new.",
      responseKey: "created",
    });

    const submitInit = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    const sent = JSON.parse(submitInit.body as string);
    expect(sent.body).toEqual({ title: "Hi", count: 3 });
    expect(readData(doc, "created")).toEqual({ id: 7 });
    expect(readData(doc, statusKey("form:form.new."))).toBe("live");
  });
});
