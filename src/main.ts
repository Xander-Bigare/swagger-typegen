import path from "node:path";
import { mkdirp, writeTextFile } from "./utils/fs";
import { Config } from "./config/types";
import { expandSpecInputs } from "./openapi/loadSpec";
import { filterRoutes } from "./openapi/filterRoutes";
import { pruneSchemas } from "./openapi/pruneSchemas";
import { emitTypesForSpec } from "./generate/typescript/emitIndex";
import { mergeSpecsAndEmit } from "./merge/mergeSpecs";
import { formatTs } from "./utils/format";
import { applyTemplate } from "./utils/template";
import { logInfo } from "./utils/logger";

export async function runGenerate(cfg: Config): Promise<void> {
  const outDir = path.resolve(cfg.output.dir);
  await mkdirp(outDir);

  const expanded = await expandSpecInputs(cfg);

  if (expanded.length === 0) {
    throw new Error("No specs found. Check your config paths.");
  }

  if (cfg.mode.mergeOutput) {
    const merged = await mergeSpecsAndEmit(cfg, expanded);
    const formatted = await formatTs(merged);
    const outPath = path.join(outDir, cfg.output.mergedFileName);
    await writeTextFile(outPath, formatted);
    logInfo(`Wrote merged types: ${outPath}`);
    return;
  }

  for (const spec of expanded) {
    const filtered = filterRoutes(spec.document, spec.routes);
    const pruned = cfg.features.pruneUnusedSchemas ? pruneSchemas(filtered) : filtered;

    const ts = emitTypesForSpec({
      specId: spec.specId,
      sourcePath: spec.sourcePath,
      document: pruned,
      operationTypePrefix: "", // per spec file doesn't need prefix; change if desired
    });

    const formatted = await formatTs(ts);
    const fileName = applyTemplate(cfg.output.perSpecFileName, { specId: spec.specId });
    const outPath = path.join(outDir, fileName);
    await writeTextFile(outPath, formatted);
    logInfo(`Wrote spec types: ${outPath}`);
  }
}
