function isObject(v: any): v is Record<string, any> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function diffSchemas(a: any, b: any, path: string = "$"): string | null {
  if (a === b) return null;

  const ta = Array.isArray(a) ? "array" : typeof a;
  const tb = Array.isArray(b) ? "array" : typeof b;
  if (ta !== tb) return `${path}: type mismatch (${ta} vs ${tb})`;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}: array length mismatch (${a.length} vs ${b.length})`;
    for (let i = 0; i < a.length; i++) {
      const d = diffSchemas(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }

  if (isObject(a) && isObject(b)) {
    const keysA = new Set(Object.keys(a));
    const keysB = new Set(Object.keys(b));

    for (const k of keysA) {
      if (!keysB.has(k)) return `${path}: key missing in B: ${k}`;
    }
    for (const k of keysB) {
      if (!keysA.has(k)) return `${path}: key missing in A: ${k}`;
    }

    for (const k of [...keysA].sort()) {
      const d = diffSchemas(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
    return null;
  }

  // primitives
  return `${path}: value mismatch (${JSON.stringify(a)} vs ${JSON.stringify(b)})`;
}
