const IGNORED_KEYS = new Set([
  "description",
  "example",
  "examples",
  "title",
  "externalDocs",
  "format",
]);

function isObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function sortObjectKeys(obj: Record<string, any>): Record<string, any> {
  return Object.fromEntries(Object.keys(obj).sort().map((k) => [k, obj[k]]));
}

export function canonicalizeSchema(schema: any): any {
  if (schema == null) return schema;
  if (Array.isArray(schema)) {
    // for oneOf/anyOf/allOf order isn't semantically important, so sort by stable JSON
    const canonItems = schema.map(canonicalizeSchema);
    return canonItems.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  }
  if (!isObject(schema)) return schema;

  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(schema)) {
    if (k.startsWith("x-")) continue; // vendor extensions ignored
    if (IGNORED_KEYS.has(k)) continue;
    out[k] = canonicalizeSchema(v);
  }

  // Normalize some common containers
  if (isObject(out.properties)) out.properties = sortObjectKeys(out.properties);
  if (Array.isArray(out.required)) out.required = [...out.required].sort();

  // Ensure stable key order
  return sortObjectKeys(out);
}
