# swagger-typegen

Generate TypeScript types from OpenAPI (Swagger) specs, with optional route filtering and a “merge output” mode.

## Purpose

Given one or more OpenAPI specs (JSON/YAML), `swagger-typegen` can:

- Load **OpenAPI 3.x** specs (and bundle external `$ref`s).
- Optionally convert **Swagger/OpenAPI 2.0 → OpenAPI 3.x**.
- Filter paths/operations via `include` / `exclude` rules (glob-style).
- Optionally prune **unused `components.schemas`** after filtering.
- Emit TypeScript:
  - `export type` aliases for schemas
  - `export enum` declarations for enum schemas and inline enums
  - operation “shape” types (params/body/response)

## Install & Usage

```bash
# Install & Build
[1] npm i
[2] npm run build
# Generating (Automatically picks up local config file if present)
[3] npx swagger-typegen generate
# Or, specify config file explicitly
[3](alternate) npx swagger-typegen generate --config ./swagger-typegen.config.yaml
```