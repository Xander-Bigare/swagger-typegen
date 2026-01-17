import prettier from "prettier";

export async function formatTs(code: string): Promise<string> {
  try {
    return await prettier.format(code, { parser: "typescript" });
  } catch {
    // if prettier fails, return raw (still usable)
    return code;
  }
}
