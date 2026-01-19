import path from "node:path";
import fs from "node:fs/promises";
import fg from "fast-glob";
import YAML from "yaml";
import SwaggerParser from "@apidevtools/swagger-parser";
import { Config, ExpandedSpecInput, SpecConfig, SpecRoutes } from "../config/types";
import { convertV2ToV3 } from "./convertV2ToV3";
import { makeSpecIdFromFilename } from "../utils/naming";
import { logInfo } from "../utils/logger";

async function statSafe(p: string) {
  try {
    return await fs.stat(p);
  } catch {
    return null;
  }
}

function parseAny(filePath: string, text: string): any {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") return YAML.parse(text);
  if (ext === ".json") return JSON.parse(text);
  // fallback
  try {
    return YAML.parse(text);
  } catch {
    return JSON.parse(text);
  }
}

function detectVersion(obj: any): "oas3" | "swagger2" | "unknown" {
  if (obj && typeof obj.openapi === "string" && obj.openapi.startsWith("3.")) return "oas3";
  if (obj && obj.swagger === "2.0") return "swagger2";
  return "unknown";
}

async function bundleOpenApi(docPath: string): Promise<any> {
  // bundle resolves external refs but keeps internal refs where possible
  return SwaggerParser.bundle(docPath);
}

async function loadOneSpecFile(
  cfg: Config,
  specCfg: SpecConfig,
  filePath: string,
  derivedIdPrefix?: string
): Promise<ExpandedSpecInput> {
  const absPath = path.resolve(filePath);
  const text = await fs.readFile(absPath, "utf8");
  const rawObj = parseAny(absPath, text);

  const kind = detectVersion(rawObj);
  let oas3Obj: any;

  if (kind === "swagger2") {
    if (!cfg.allowV2Conversion) {
      throw new Error(`Spec is Swagger/OpenAPI 2.0 but allowV2Conversion=false: ${absPath}`);
    }
    oas3Obj = await convertV2ToV3(rawObj, absPath);
  } else if (kind === "oas3") {
    // use bundled version so external refs work
    oas3Obj = await bundleOpenApi(absPath);
  } else {
    // try to bundle anyway; SwaggerParser might still parse it
    oas3Obj = await bundleOpenApi(absPath);
  }

  // basic check
  if (!oas3Obj?.openapi || !String(oas3Obj.openapi).startsWith("3.")) {
    throw new Error(`Spec did not resolve to OpenAPI 3.x: ${absPath}`);
  }

  const baseId = specCfg.id ?? makeSpecIdFromFilename(absPath);
  const specId =
    derivedIdPrefix && derivedIdPrefix !== baseId ? `${derivedIdPrefix}__${baseId}` : baseId;

  const routes: SpecRoutes = specCfg.routes ?? {};
  logInfo(`Loaded spec ${specId} from ${absPath}`);

  return {
    specId,
    sourcePath: absPath,
    routes,
    document: oas3Obj,
  };
}

async function listSpecFiles(inputPath: string): Promise<string[]> {
  const abs = path.resolve(inputPath);
  const st = await statSafe(abs);
  if (st?.isDirectory()) {
    const files = await fg(["**/*.yaml", "**/*.yml", "**/*.json"], { cwd: abs, absolute: true });
    return files;
  }
  return [abs];
}

export async function expandSpecInputs(cfg: Config): Promise<ExpandedSpecInput[]> {
  const out: ExpandedSpecInput[] = [];
  for (const specCfg of cfg.specs) {
    const files = await listSpecFiles(specCfg.input);
    const prefix = specCfg.id; // if folder, use id as prefix for derived specIds
    for (const f of files) {
      const derivedPrefix = (await (async () => {
        const st = await statSafe(path.resolve(specCfg.input));
        return st?.isDirectory() ? prefix : undefined;
      })()) as string | undefined;

      out.push(await loadOneSpecFile(cfg, specCfg, f, derivedPrefix));
    }
  }
  return out;
}
