function refToSchemaName(ref: string): string | null {
  const prefix = "#/components/schemas/";
  if (ref.startsWith(prefix)) return ref.slice(prefix.length);
  return null;
}

function walkAny(node: any, refs: Set<string>) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const x of node) walkAny(x, refs);
    return;
  }
  if (typeof node.$ref === "string") refs.add(node.$ref);
  for (const v of Object.values(node)) walkAny(v, refs);
}

export function pruneSchemas(doc: any): any {
  const schemas = doc?.components?.schemas ?? {};
  const seenSchemaNames = new Set<string>();
  const pendingRefs = new Set<string>();

  // seed refs from selected operations
  walkAny(doc.paths ?? {}, pendingRefs);

  // BFS: refs -> schema -> more refs
  const queue: string[] = [...pendingRefs];
  while (queue.length) {
    const ref = queue.pop()!;
    const name = refToSchemaName(ref);
    if (!name) continue;
    if (seenSchemaNames.has(name)) continue;
    if (!schemas[name]) continue;

    seenSchemaNames.add(name);

    const newRefs = new Set<string>();
    walkAny(schemas[name], newRefs);
    for (const r of newRefs) {
      if (!pendingRefs.has(r)) {
        pendingRefs.add(r);
        queue.push(r);
      }
    }
  }

  const pruned = JSON.parse(JSON.stringify(doc));
  pruned.components = pruned.components ?? {};
  pruned.components.schemas = {};

  for (const name of seenSchemaNames) {
    pruned.components.schemas[name] = schemas[name];
  }

  return pruned;
}
