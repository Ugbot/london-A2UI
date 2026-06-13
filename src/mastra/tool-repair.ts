/**
 * Tool-call repair middleware.
 *
 * Some models (notably faster ones like Haiku) occasionally emit malformed JSON
 * for a tool call's arguments — e.g. valid JSON followed by trailing characters
 * ("Unexpected non-whitespace character after JSON at position N"). The AG-UI
 * client assembles the streamed argument deltas and JSON.parses them; a bad
 * parse throws a run error that wedges the whole chat thread.
 *
 * This is a LanguageModel middleware (so it applies to BOTH the interactive
 * agent and the headless build API, since both resolve their model through
 * provider.ts). It buffers each tool call's argument deltas, then:
 *   - if the assembled JSON is valid, passes it through;
 *   - if it's valid JSON plus trailing junk, repairs it to the valid prefix;
 *   - if it's unrepairable, DROPS the tool call entirely (nothing reaches the
 *     client) rather than letting a parse error kill the run.
 */
import { wrapLanguageModel, type LanguageModelMiddleware } from "ai";
import { repairToolArgs } from "@/lib/json-repair";

export { repairToolArgs };

// The streamed parts are a large discriminated union; we only touch a few
// fields, so type them minimally to stay resilient across SDK versions.
type StreamPart = {
  type: string;
  id?: string;
  toolCallId?: string;
  delta?: string;
  input?: string;
  [k: string]: unknown;
};

export const toolCallRepairMiddleware: LanguageModelMiddleware = {
  specificationVersion: "v3",
  // Streaming path (the interactive agent): buffer arg deltas per tool call,
  // re-emit a single repaired delta, and drop calls that can't be salvaged.
  wrapStream: async ({ doStream }) => {
    const { stream, ...rest } = await doStream();
    const pending = new Map<string, { start: StreamPart; buf: string }>();
    const dropped = new Set<string>();

    const transform = new TransformStream<StreamPart, StreamPart>({
      transform(part, controller) {
        switch (part.type) {
          case "tool-input-start": {
            // Defer the start until we know the args are usable.
            if (part.id) pending.set(part.id, { start: part, buf: "" });
            else controller.enqueue(part);
            return;
          }
          case "tool-input-delta": {
            const p = part.id ? pending.get(part.id) : undefined;
            if (p) {
              p.buf += part.delta ?? "";
              return; // suppress; re-emitted (repaired) at input-end
            }
            controller.enqueue(part);
            return;
          }
          case "tool-input-end": {
            const p = part.id ? pending.get(part.id) : undefined;
            if (!p) {
              controller.enqueue(part);
              return;
            }
            pending.delete(part.id!);
            const repaired = repairToolArgs(p.buf);
            if (repaired === null) {
              dropped.add(part.id!); // also drop the matching tool-call part
              return;
            }
            controller.enqueue(p.start);
            controller.enqueue({ type: "tool-input-delta", id: part.id, delta: repaired });
            controller.enqueue(part);
            return;
          }
          case "tool-call": {
            const id = part.toolCallId ?? "";
            if (dropped.has(id)) {
              dropped.delete(id);
              return; // drop the unparseable tool call
            }
            const repaired = repairToolArgs(part.input ?? "");
            if (repaired === null) return; // drop (no preceding deltas case)
            controller.enqueue(repaired === part.input ? part : { ...part, input: repaired });
            return;
          }
          default:
            controller.enqueue(part);
        }
      },
    });

    return {
      stream: (stream as unknown as ReadableStream<StreamPart>).pipeThrough(
        transform,
      ) as unknown as typeof stream,
      ...rest,
    };
  },

  // Non-streaming path (e.g. some build calls): repair / drop tool-call parts.
  wrapGenerate: async ({ doGenerate }) => {
    const result = await doGenerate();
    const content = (result as { content?: StreamPart[] }).content;
    if (Array.isArray(content)) {
      (result as { content: StreamPart[] }).content = content.flatMap((part) => {
        if (part.type !== "tool-call") return [part];
        const repaired = repairToolArgs(part.input ?? "");
        if (repaired === null) return [];
        return [repaired === part.input ? part : { ...part, input: repaired }];
      });
    }
    return result;
  },
};

/** Wrap a language model so malformed tool-call args are repaired or dropped. */
export function withToolCallRepair<M>(model: M): M {
  return wrapLanguageModel({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    model: model as any,
    middleware: toolCallRepairMiddleware,
  }) as M;
}
