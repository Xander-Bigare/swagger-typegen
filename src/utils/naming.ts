import path from "node:path";

export function toPascalCase(s: string): string {
  return String(s)
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(/\s+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
}

export function toSafeIdentifier(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, "_");
  const prefixed = /^[A-Za-z_]/.test(cleaned) ? cleaned : "_" + cleaned;
  // Avoid empty
  return prefixed || "Unnamed";
}

export function makeSpecIdFromFilename(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(yaml|yml|json)$/i, "");
  return toSafeIdentifier(base);
}
