import micromatch from "micromatch";
import { SpecRoutes, HttpMethod } from "../config/types";

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "TRACE"];

function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function methodKeyToHttpMethod(methodKey: string): HttpMethod | null {
  const m = methodKey.toUpperCase();
  return (METHODS as string[]).includes(m) ? (m as HttpMethod) : null;
}

function matchesRule(pathname: string, method: HttpMethod, rule: { path: string; methods?: HttpMethod[] }): boolean {
  if (!micromatch.isMatch(pathname, rule.path, { dot: true })) return false;
  if (!rule.methods || rule.methods.length === 0) return true;
  return rule.methods.map((x) => x.toUpperCase()).includes(method);
}

function isIncluded(pathname: string, method: HttpMethod, routes: SpecRoutes): boolean {
  const includes = routes.include ?? [];
  const excludes = routes.exclude ?? [];

  const included =
    includes.length === 0 ? true : includes.some((r) => matchesRule(pathname, method, r));

  const excluded = excludes.some((r) => matchesRule(pathname, method, r));
  return included && !excluded;
}

export function filterRoutes(doc: any, routes: SpecRoutes): any {
  const out = deepClone(doc);
  const paths = out.paths ?? {};
  const newPaths: any = {};

  for (const [p, item] of Object.entries<any>(paths)) {
    const newItem: any = {};
    for (const [methodKey, op] of Object.entries<any>(item ?? {})) {
      const hm = methodKeyToHttpMethod(methodKey);
      if (!hm) {
        // keep non-method keys like "parameters" at path-item level
        if (methodKey === "parameters") newItem[methodKey] = op;
        continue;
      }
      if (isIncluded(p, hm, routes)) newItem[methodKey.toLowerCase()] = op;
    }

    // keep path if it has any methods after filtering
    const hasMethod = Object.keys(newItem).some((k) => !!methodKeyToHttpMethod(k));
    if (hasMethod) newPaths[p] = newItem;
  }

  out.paths = newPaths;
  return out;
}
