import fs from "node:fs/promises";
import path from "node:path";
import { Config } from "./types";
import { parseYamlOrJson } from "../utils/parseAny";

const DEFAULT_CONFIG: Omit<Config, "specs"> = {
  version: 1,
  allowV2Conversion: false,
  output: {
    dir: "./output",
    perSpecFileName: "{specId}.types.ts",
    mergedFileName: "api-types.ts",
  },
  mode: { mergeOutput: false },
  features: { pruneUnusedSchemas: true },
};

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function validateConfig(raw: any): asserts raw is Config {
  if (!isObject(raw)) throw new Error("Config must be an object.");
  if (raw.version !== 1) throw new Error("Config.version must be 1.");

  if (!Array.isArray(raw.specs)) throw new Error("Config.specs must be an array.");
  for (const s of raw.specs) {
    if (!isObject(s)) throw new Error("Each spec entry must be an object.");
    if (typeof s.input !== "string") throw new Error("Each spec must have input: string");
    if (s.id != null && typeof s.id !== "string") throw new Error("spec.id must be a string if provided.");
  }

  if (!isObject(raw.output)) throw new Error("Config.output must be an object.");
  if (typeof raw.output.dir !== "string") throw new Error("output.dir must be a string.");
  if (typeof raw.output.perSpecFileName !== "string") throw new Error("output.perSpecFileName must be a string.");
  if (typeof raw.output.mergedFileName !== "string") throw new Error("output.mergedFileName must be a string.");

  if (!isObject(raw.mode) || typeof raw.mode.mergeOutput !== "boolean") {
    throw new Error("mode.mergeOutput must be a boolean.");
  }

  if (typeof raw.allowV2Conversion !== "boolean") throw new Error("allowV2Conversion must be a boolean.");

  if (!isObject(raw.features) || typeof raw.features.pruneUnusedSchemas !== "boolean") {
    throw new Error("features.pruneUnusedSchemas must be a boolean.");
  }
}

export async function loadConfig(configPath?: string): Promise<Config> {
  const cwd = process.cwd();

  const candidates = [
    "swagger-typegen.config.yaml",
    "swagger-typegen.config.yml",
    "swagger-typegen.config.json",
  ].map((f) => path.join(cwd, f));

  const resolvedPath = configPath
    ? path.resolve(configPath)
    : (await (async () => {
        for (const c of candidates) {
          if (await fileExists(c)) return c;
        }
        return undefined;
      })());

  if (!resolvedPath) {
    throw new Error(
      "No config found. Provide --config or create swagger-typegen.config.(yaml|yml|json) in the current directory."
    );
  }

  const text = await fs.readFile(resolvedPath, "utf8");
  const raw = parseYamlOrJson(resolvedPath, text);

  // merge defaults
  const merged: Config = {
    ...DEFAULT_CONFIG,
    ...raw,
    output: { ...DEFAULT_CONFIG.output, ...(raw?.output ?? {}) },
    mode: { ...DEFAULT_CONFIG.mode, ...(raw?.mode ?? {}) },
    features: { ...DEFAULT_CONFIG.features, ...(raw?.features ?? {}) },
    specs: raw?.specs ?? [],
  };

  validateConfig(merged);
  return merged;
}
