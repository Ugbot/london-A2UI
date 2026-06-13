/**
 * Minimal Zod → JSON-schema converter for surfacing brick prop shapes to the
 * agent (tool context) and the brick catalog. Covers exactly the Zod
 * constructs used by the brick schemas: object, string, number, boolean, enum,
 * array, optional, default, effects, lazy, record.
 *
 * Reading Zod's internal `_def` requires loose typing; it is confined to this
 * file behind the `ZodDefLike` shape.
 */
import type { ZodTypeAny } from "zod";

interface ZodDefLike {
  typeName?: string;
  shape?: () => Record<string, ZodTypeAny>;
  type?: ZodTypeAny;
  innerType?: ZodTypeAny;
  schema?: ZodTypeAny;
  getter?: () => ZodTypeAny;
  values?: string[];
  defaultValue?: () => unknown;
}

type JsonSchema = Record<string, unknown>;

function defOf(schema: ZodTypeAny): ZodDefLike {
  return (schema as unknown as { _def: ZodDefLike })._def;
}

function isOptional(schema: ZodTypeAny): boolean {
  const tn = defOf(schema).typeName;
  return tn === "ZodOptional" || tn === "ZodDefault";
}

function convert(schema: ZodTypeAny): JsonSchema {
  const def = defOf(schema);
  switch (def.typeName) {
    case "ZodObject": {
      const shape = def.shape?.() ?? {};
      const properties: JsonSchema = {};
      const required: string[] = [];
      for (const [key, child] of Object.entries(shape)) {
        properties[key] = convert(child);
        if (!isOptional(child)) required.push(key);
      }
      const out: JsonSchema = { type: "object", properties };
      if (required.length > 0) out.required = required;
      return out;
    }
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodEnum":
      return { type: "string", enum: def.values ?? [] };
    case "ZodArray":
      return { type: "array", items: def.type ? convert(def.type) : {} };
    case "ZodOptional":
      return def.innerType ? convert(def.innerType) : {};
    case "ZodDefault": {
      const inner = def.innerType ? convert(def.innerType) : {};
      if (def.defaultValue) {
        try {
          inner.default = def.defaultValue();
        } catch {
          // some defaults are factory-only; skip if it throws
        }
      }
      return inner;
    }
    case "ZodEffects":
      return def.schema ? convert(def.schema) : {};
    case "ZodLazy":
      return def.getter ? convert(def.getter()) : {};
    case "ZodRecord":
      return { type: "object" };
    default:
      return {};
  }
}

/** Convert a Zod schema to a compact JSON-schema object. */
export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
  return convert(schema);
}
