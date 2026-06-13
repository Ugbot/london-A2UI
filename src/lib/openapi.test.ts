import { describe, it, expect } from "vitest";
import { parseOpenApi } from "./openapi";

const SPEC = {
  openapi: "3.0.0",
  info: { title: "Pet Store" },
  servers: [{ url: "https://api.petstore.io/v1" }],
  paths: {
    "/pets": {
      get: { operationId: "listPets", summary: "List pets" },
      post: {
        operationId: "createPet",
        summary: "Create a pet",
        requestBody: {
          content: {
            "application/json": { schema: { $ref: "#/components/schemas/Pet" } },
          },
        },
      },
    },
    "/pets/{id}": {
      get: { summary: "Get a pet" }, // no operationId → derived id
    },
  },
  components: {
    schemas: {
      Pet: {
        type: "object",
        properties: { name: { type: "string" }, owner: { $ref: "#/components/schemas/Owner" } },
      },
      Owner: { type: "object", properties: { email: { type: "string" } } },
    },
  },
};

describe("parseOpenApi", () => {
  it("extracts name + base URL", () => {
    const p = parseOpenApi(SPEC);
    expect(p.name).toBe("Pet Store");
    expect(p.baseUrl).toBe("https://api.petstore.io/v1");
  });

  it("extracts an endpoint per path+method with method/path/summary", () => {
    const p = parseOpenApi(SPEC);
    expect(p.endpoints).toHaveLength(3);
    const post = p.endpoints.find((e) => e.id === "createPet")!;
    expect(post.method).toBe("POST");
    expect(post.path).toBe("/pets");
    expect(post.summary).toBe("Create a pet");
  });

  it("resolves a local $ref (incl. nested) in the request body schema", () => {
    const post = parseOpenApi(SPEC).endpoints.find((e) => e.id === "createPet")!;
    const schema = post.requestSchema as Record<string, unknown>;
    const props = schema.properties as Record<string, Record<string, unknown>>;
    expect(props.name.type).toBe("string");
    // nested $ref (Pet.owner → Owner) resolved, not left as a $ref
    expect(props.owner.type).toBe("object");
    expect(JSON.stringify(schema)).not.toContain("$ref");
  });

  it("does NOT follow remote $refs (drops to {})", () => {
    const remote = {
      openapi: "3.0.0",
      info: { title: "X" },
      servers: [{ url: "https://x.io" }],
      paths: {
        "/y": {
          post: {
            operationId: "y",
            requestBody: { content: { "application/json": { schema: { $ref: "https://evil.com/schema.json" } } } },
          },
        },
      },
    };
    const ep = parseOpenApi(remote).endpoints[0];
    expect(ep.requestSchema).toEqual({});
  });

  it("derives a slug id when operationId is absent", () => {
    const ep = parseOpenApi(SPEC).endpoints.find((e) => e.path === "/pets/{id}" && e.method === "GET")!;
    expect(ep.id).toMatch(/^[a-z0-9-]+$/);
  });

  it("supports Swagger 2.0 host + basePath + schemes", () => {
    const swagger = {
      swagger: "2.0",
      info: { title: "Legacy" },
      host: "old.example.com",
      basePath: "/api",
      schemes: ["https"],
      paths: { "/ping": { get: { operationId: "ping" } } },
    };
    const p = parseOpenApi(swagger);
    expect(p.baseUrl).toBe("https://old.example.com/api");
    expect(p.endpoints[0].id).toBe("ping");
  });

  it("throws on a spec with no endpoints", () => {
    expect(() => parseOpenApi({ info: { title: "Empty" }, paths: {} })).toThrow();
  });
});
