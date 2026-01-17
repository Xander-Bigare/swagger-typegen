import swagger2openapi from "swagger2openapi";

export async function convertV2ToV3(swagger2: any, sourcePath: string): Promise<any> {
  try {
    const res = await swagger2openapi.convertObj(swagger2, {
      patch: true,
      warnOnly: false,
    });
    if (!res?.openapi) throw new Error("Conversion result missing openapi field");
    return res.openapi;
  } catch (e: any) {
    throw new Error(`Failed to convert Swagger v2 → OpenAPI v3 for ${sourcePath}: ${e?.message ?? e}`);
  }
}
