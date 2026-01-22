#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { runGenerate } from "../main";
import { loadConfig } from "../config/loadConfig";
import { mkdirp, writeTextFile } from "../utils/fs";

const program = new Command();

program
  .name("swagger-typegen")
  .description("Generate TS types from OpenAPI specs");

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

function exampleConfigYml(): string {
  return `# swagger-typegen example config
version: 1

# If you have Swagger/OpenAPI v2 specs, set this to true to auto-convert to OpenAPI v3.
allowV2Conversion: true

output:
  # Where generated files are written
  dir: ./output
  # Used when mode.mergeOutput is false
  perSpecFileName: "{specId}.types.ts"
  # Used when mode.mergeOutput is true
  mergedFileName: "api-types.ts"

mode:
  # false => one output file per spec (or per file when using a folder input)
  # true  => a single merged output file for all specs
  mergeOutput: false

features:
  pruneUnusedSchemas: true

specs:
  # Folder input: recursively loads **/*.yaml, **/*.yml, **/*.json
  - id: api
    input: ./swaggers/

    # Optional route filtering example:
    # routes:
    #   include:
    #     - path: "/users/**"
    #       methods: [GET, POST]
    #   exclude:
    #     - path: "/internal/**"
`;
}

program
  .command("generate")
  .option("--config <path>", "Path to config file (yaml/yml/json)")
  .action(async (opts) => {
    const cfg = await loadConfig(opts.config);
    await runGenerate(cfg);
  });

program
  .command("init")
  .description(
    "Create a ./swaggers folder and a swagger-typegen.config.yml example config",
  )
  .option(
    "--dir <path>",
    "Base directory to write into (default: current working directory)",
  )
  .option("--force", "Overwrite existing files", false)
  .action(async (opts) => {
    const baseDir = path.resolve(opts.dir ?? process.cwd());
    const swaggersDir = path.join(baseDir, "swaggers");
    const configPath = path.join(baseDir, "swagger-typegen.config.yml");
    const swaggersReadmePath = path.join(swaggersDir, "README.md");

    await mkdirp(swaggersDir);

    if (!opts.force) {
      if (await pathExists(configPath)) {
        throw new Error(
          `Refusing to overwrite existing config: ${configPath}\n` +
            `Use --force to overwrite.`,
        );
      }
      if (await pathExists(swaggersReadmePath)) {
        // avoid clobbering user content
      } else {
        await writeTextFile(
          swaggersReadmePath,
          `Put your OpenAPI specs here (JSON/YAML).\nThis folder is scanned recursively when referenced in the config.\n`,
        );
      }
    } else {
      await writeTextFile(
        swaggersReadmePath,
        `Put your OpenAPI specs here (JSON/YAML).\nThis folder is scanned recursively when referenced in the config.\n`,
      );
    }

    await writeTextFile(configPath, exampleConfigYml());

    console.log(`Created: ${path.relative(process.cwd(), configPath)}`);
    console.log(`Created: ${path.relative(process.cwd(), swaggersDir)}/`);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
