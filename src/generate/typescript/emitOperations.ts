import { schemaToTs, TypegenContext } from "./emitSchemas";
import { toPascalCase, toSafeIdentifier } from "../../utils/naming";

type ParamBucket = { path: any[]; query: any[]; header: any[] };

function collectParameters(pathItem: any, op: any): ParamBucket {
  const all: any[] = [];
  if (Array.isArray(pathItem?.parameters)) all.push(...pathItem.parameters);
  if (Array.isArray(op?.parameters)) all.push(...op.parameters);

  const bucket: ParamBucket = { path: [], query: [], header: [] };
  for (const p of all) {
    if (!p) continue;
    const loc = p.in;
    if (loc === "path") bucket.path.push(p);
    else if (loc === "query") bucket.query.push(p);
    else if (loc === "header") bucket.header.push(p);
  }
  return bucket;
}

function paramsObjectTs(
  params: any[],
  ctx: TypegenContext,
  hintPrefix: string,
): string {
  if (!params.length) return "{}";
  const req = new Set<string>(
    params.filter((p) => p.required).map((p) => p.name),
  );

  const lines = params.map((p) => {
    const key = /^[A-Za-z_][A-Za-z0-9_]*$/.test(p.name)
      ? p.name
      : JSON.stringify(p.name);
    const opt = req.has(p.name) ? "" : "?";

    let schema: any = p?.schema;
    if (!schema && p?.content && typeof p.content === "object") {
      const first = Object.values<any>(p.content)[0];
      schema = first && typeof first === "object" ? first.schema : undefined;
    }

    const paramHint = `${hintPrefix}${toPascalCase(p.name)}`;
    return `${key}${opt}: ${schemaToTs(schema, ctx, paramHint)};`;
  });

  return `{ ${lines.join(" ")} }`;
}

function pickContentSchema(content: any): any {
  if (!content || typeof content !== "object") return undefined;
  if (content["application/json"]?.schema)
    return content["application/json"].schema;
  const first = Object.values<any>(content)[0];
  return first?.schema;
}

function opName(method: string, path: string, operation: any): string {
  if (operation?.operationId)
    return toSafeIdentifier(toPascalCase(operation.operationId));
  const cleaned = path
    .replace(/[{}]/g, "")
    .split("/")
    .filter(Boolean)
    .map(toPascalCase)
    .join("");
  return toSafeIdentifier(toPascalCase(method) + cleaned);
}

function emitOneOperation(args: {
  operationTypePrefix: string;
  path: string;
  method: string;
  pathItem: any;
  operation: any;
  ctx: TypegenContext;
}): string {
  const { operationTypePrefix, path, method, pathItem, operation, ctx } = args;

  const baseName = opName(method, path, operation);
  const name = operationTypePrefix
    ? `${operationTypePrefix}${baseName}`
    : baseName;

  const buckets = collectParameters(pathItem, operation);

  const pathParams = paramsObjectTs(buckets.path, ctx, `${name}PathParam`);
  const queryParams = paramsObjectTs(buckets.query, ctx, `${name}QueryParam`);
  const headerParams = paramsObjectTs(buckets.header, ctx, `${name}Header`);

  const reqBodySchema = pickContentSchema(operation?.requestBody?.content);
  const reqBodyTs = reqBodySchema
    ? schemaToTs(reqBodySchema, ctx, `${name}RequestBody`)
    : "undefined";

  const responses = operation?.responses ?? {};
  const variants: string[] = [];

  for (const [status, resp] of Object.entries<any>(responses)) {
    const schema = pickContentSchema(resp?.content);
    const bodyTs = schema
      ? schemaToTs(
          schema,
          ctx,
          `${name}Response${status === "default" ? "Default" : status}`,
        )
      : "unknown";
    const statusLit =
      status === "default"
        ? `"default"`
        : /^[0-9]{3}$/.test(status)
          ? status
          : JSON.stringify(status);
    variants.push(`{ status: ${statusLit}; body: ${bodyTs}; }`);
  }

  const respUnion = variants.length ? variants.join(" | ") : "unknown";

  return [
    `// ${method.toUpperCase()} ${path}`,
    `export type ${name}PathParams = ${pathParams};`,
    `export type ${name}QueryParams = ${queryParams};`,
    `export type ${name}Headers = ${headerParams};`,
    `export type ${name}RequestBody = ${reqBodyTs};`,
    `export type ${name}Response = ${respUnion};`,
  ].join("\n");
}

export function emitOperations(
  doc: any,
  ctx: TypegenContext,
  operationTypePrefix: string,
): string {
  const out: string[] = [];
  const paths = doc?.paths ?? {};
  const methodKeys = [
    "get",
    "post",
    "put",
    "patch",
    "delete",
    "head",
    "options",
    "trace",
  ];

  for (const [p, pathItem] of Object.entries<any>(paths)) {
    for (const m of methodKeys) {
      const op = pathItem?.[m];
      if (!op) continue;

      out.push(
        emitOneOperation({
          operationTypePrefix,
          path: p,
          method: m,
          pathItem,
          operation: op,
          ctx,
        }),
      );
      out.push("");
    }
  }

  return out.join("\n").trim();
}
