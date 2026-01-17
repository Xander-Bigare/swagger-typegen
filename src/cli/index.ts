import { Command } from "commander";
import { runGenerate } from "../main";
import { loadConfig } from "../config/loadConfig";

const program = new Command();

program.name("swagger-typegen").description("Generate TS types from OpenAPI specs");

program
  .command("generate")
  .option("--config <path>", "Path to config file (yaml/yml/json)")
  .action(async (opts) => {
    const cfg = await loadConfig(opts.config);
    await runGenerate(cfg);
  });

program.parseAsync(process.argv).catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});