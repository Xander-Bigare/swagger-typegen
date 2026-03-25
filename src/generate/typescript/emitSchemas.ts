import { toPascalCase, toSafeIdentifier } from "../../utils/naming";

export type EnumMember = { key: string; value: string | number };
export type EnumDef = {
  typeName: string; // enum name, e.g. CreatePaymentRequestMethod
  members: EnumMember[];
  nullable: boolean; // if true, schemaToTs returns `${typeName} | null`
};

export type TypegenContext = {
  usedNames: Set<string>;
  enums: EnumDef[];
  enumByKey: Map<string, EnumDef>;
  schemaEnumKeyByName: Map<string, string>;
  primitiveAliasByName: Map<string, string>;
  inlinePrimitiveAliases: boolean;
};

function signatureKey(values: any[], nullable: boolean): string {
  return JSON.stringify({ values, nullable });
}

function makeUnique(base: string, used: Set<string>): string {
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}${i}`)) i++;
  return `${base}${i}`;
}

export function createTypegenContext(opts?: {
  reservedNames?: string[];
  schemaEnumKeyByName?: Map<string, string>;
  primitiveAliasByName?: Map<string, string>;
  inlinePrimitiveAliases?: boolean;
}): TypegenContext {
  const used = new Set<string>(opts?.reservedNames ?? []);
  return {
    usedNames: used,
    enums: [],
    enumByKey: new Map(),
    schemaEnumKeyByName: opts?.schemaEnumKeyByName ?? new Map(),
    primitiveAliasByName: opts?.primitiveAliasByName ?? new Map(),
    inlinePrimitiveAliases: opts?.inlinePrimitiveAliases ?? false,
  };
}

function primitiveSchemaToTs(schema: any): string | undefined {
  if (!schema || schema.$ref) return undefined;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) return undefined;
  if (schema.oneOf?.length || schema.anyOf?.length || schema.allOf?.length) {
    return undefined;
  }

  const type = schema.type;

  if (type === "string") return schema?.nullable ? `(string) | null` : "string";
  if (type === "integer" || type === "number") {
    return schema?.nullable ? `(number) | null` : "number";
  }
  if (type === "boolean") return schema?.nullable ? `(boolean) | null` : "boolean";
  if (type === "null") return "null";

  return undefined;
}

export function collectPrimitiveAliasByName(doc: any): Map<string, string> {
  const out = new Map<string, string>();
  const schemas = doc?.components?.schemas ?? {};

  for (const rawName of Object.keys(schemas)) {
    const name = toSafeIdentifier(rawName);
    const primitiveTs = primitiveSchemaToTs(schemas[rawName]);
    if (primitiveTs) {
      out.set(name, primitiveTs);
    }
  }

  return out;
}

function refTypeName(ref: string, ctx: TypegenContext): string {
  const prefix = "#/components/schemas/";
  const rawName = ref.startsWith(prefix)
    ? ref.slice(prefix.length)
    : ref.split("/").filter(Boolean).pop() ?? "UnknownRef";

  const name = toSafeIdentifier(rawName);

  if (ctx.inlinePrimitiveAliases) {
    const primitive = ctx.primitiveAliasByName.get(name);
    if (primitive) return primitive;
  }

  return name;
}

function wrapNullable(ts: string, schema: any): string {
  return schema?.nullable ? `(${ts}) | null` : ts;
}

function enumMemberNameFromValue(v: string | number): string {
  if (typeof v === "number")
    return `Value${String(v).replace(/[^0-9]/g, "") || "Number"}`;

  // Convert value -> PascalCase identifier
  // "bank_transfer" -> "BankTransfer"
  // "bank-transfer" -> "BankTransfer"
  // "2fa" -> "Value2Fa"
  let name = toPascalCase(String(v).replace(/[^A-Za-z0-9]+/g, " "));
  if (!name) name = "Value";

  // Must be a valid TS identifier start
  if (!/^[A-Za-z_]/.test(name)) name = `Value${name}`;
  // Remove any remaining invalid chars just in case
  name = name.replace(/[^A-Za-z0-9_]/g, "");

  // Avoid a few awkward reserved-ish names
  if (name === "Default") name = "DefaultValue";

  return name;
}

function registerEnum(
  ctx: TypegenContext,
  nameHint: string,
  values: any[],
  nullable: boolean,
): string {
  const baseTypeName = toSafeIdentifier(toPascalCase(nameHint || "Enum"));
  const sig = signatureKey(values, nullable);

  // If there's a top-level enum schema with this name:
  // - If signatures match, reuse exact name
  // - Else, do not steal the schema name; make unique
  const topLevelSig = ctx.schemaEnumKeyByName.get(baseTypeName);
  const canUseExactTopLevelName = topLevelSig != null && topLevelSig === sig;

  const key = `${baseTypeName}::${sig}`;

  const existing = ctx.enumByKey.get(key);
  if (existing) return existing.typeName;

  let typeName = baseTypeName;
  if (!canUseExactTopLevelName) {
    typeName = makeUnique(typeName, ctx.usedNames);
  }
  ctx.usedNames.add(typeName);

  // Build members with PascalCase keys (dedupe if collisions)
  const usedKeys = new Set<string>();
  const members: EnumMember[] = values.map((raw) => {
    const value = raw as string | number;
    const baseKey = enumMemberNameFromValue(value);
    let keyName = baseKey;
    let i = 2;
    while (usedKeys.has(keyName)) {
      keyName = `${baseKey}${i++}`;
    }
    usedKeys.add(keyName);
    return { key: keyName, value };
  });

  const def: EnumDef = { typeName, members, nullable };
  ctx.enums.push(def);
  ctx.enumByKey.set(key, def);

  return typeName;
}

export function schemaToTs(
  schema: any,
  ctx: TypegenContext,
  nameHint?: string,
): string {
  if (!schema) return "unknown";
  if (schema.$ref) return refTypeName(schema.$ref, ctx);

  // ENUM => emit TS enum + reference it
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    const values = schema.enum;

    // TS enums only for string|number values; otherwise fallback to union
    const ok = values.every(
      (v: any) => typeof v === "string" || typeof v === "number",
    );
    if (!ok) {
      const u =
        values.map((v: any) => JSON.stringify(v)).join(" | ") || "unknown";
      return wrapNullable(u, schema);
    }

    const hint = nameHint ?? "Enum";
    const enumName = registerEnum(ctx, hint, values, !!schema.nullable);
    return schema.nullable ? `${enumName} | null` : enumName;
  }

  const primitiveTs = primitiveSchemaToTs(schema);
  if (primitiveTs) return primitiveTs;

  if (schema.oneOf?.length) {
    const u = schema.oneOf
      .map((s: any, i: number) =>
        schemaToTs(s, ctx, `${nameHint ?? "OneOf"}${i + 1}`),
      )
      .join(" | ");
    return wrapNullable(u || "unknown", schema);
  }

  if (schema.anyOf?.length) {
    const u = schema.anyOf
      .map((s: any, i: number) =>
        schemaToTs(s, ctx, `${nameHint ?? "AnyOf"}${i + 1}`),
      )
      .join(" | ");
    return wrapNullable(u || "unknown", schema);
  }

  if (schema.allOf?.length) {
    const i = schema.allOf
      .map((s: any, j: number) =>
        schemaToTs(s, ctx, `${nameHint ?? "AllOf"}${j + 1}`),
      )
      .join(" & ");
    return wrapNullable(i || "unknown", schema);
  }

  const type = schema.type;

  if (type === "string") return wrapNullable("string", schema);
  if (type === "integer" || type === "number")
    return wrapNullable("number", schema);
  if (type === "boolean") return wrapNullable("boolean", schema);
  if (type === "null") return "null";

  if (type === "array" || schema.items) {
    const itemTs = schema.items
      ? schemaToTs(schema.items, ctx, `${nameHint ?? "Item"}Item`)
      : "unknown";
    return wrapNullable(`Array<${itemTs}>`, schema);
  }

  // object-ish
  if (type === "object" || schema.properties || schema.additionalProperties) {
    const req = new Set<string>(schema.required ?? []);
    const props: Record<string, any> = schema.properties ?? {};
    const propLines: string[] = [];

    for (const [k, v] of Object.entries<any>(props)) {
      const safeKey = /^[A-Za-z_][A-Za-z0-9_]*$/.test(k)
        ? k
        : JSON.stringify(k);
      const optional = req.has(k) ? "" : "?";
      const propHint = `${nameHint ?? "Anon"}${toPascalCase(k)}`;
      propLines.push(`${safeKey}${optional}: ${schemaToTs(v, ctx, propHint)};`);
    }

    let base = `{ ${propLines.join(" ")} }`;

    const ap = schema.additionalProperties;
    if (ap === true) {
      base = `{ [key: string]: unknown; } & ${base}`;
    } else if (ap && typeof ap === "object") {
      const apHint = `${nameHint ?? "Anon"}AdditionalProperty`;
      base = `{ [key: string]: ${schemaToTs(ap, ctx, apHint)}; } & ${base}`;
    }

    return wrapNullable(base, schema);
  }

  return wrapNullable("unknown", schema);
}

export function emitEnumExports(ctx: TypegenContext): string {
  if (!ctx.enums.length) return "";

  const out: string[] = [];
  for (const e of ctx.enums) {
    out.push(`export enum ${e.typeName} {`);
    for (const m of e.members) {
      const valLit =
        typeof m.value === "string" ? JSON.stringify(m.value) : String(m.value);
      out.push(`  ${m.key} = ${valLit},`);
    }
    out.push(`}`);
    out.push("");
  }

  return out.join("\n").trim();
}

export function emitSchemas(doc: any, ctx: TypegenContext): string {
  const schemas = doc?.components?.schemas ?? {};
  const names = Object.keys(schemas).sort();

  const out: string[] = [];
  for (const rawName of names) {
    const name = toSafeIdentifier(rawName);
    const schema = schemas[rawName];

    if (Array.isArray(schema?.enum) && schema.enum.length > 0) {
      schemaToTs(schema, ctx, name);
      continue;
    }

    const primitiveTs = primitiveSchemaToTs(schema);
    if (ctx.inlinePrimitiveAliases && primitiveTs) {
      continue;
    }

    const ts = schemaToTs(schema, ctx, name);
    out.push(`export type ${name} = ${ts};`);
  }

  return out.join("\n");
}
