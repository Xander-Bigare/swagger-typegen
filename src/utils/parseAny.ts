import path from "node:path";
import YAML from "yaml";

export function parseYamlOrJson(filePath: string, text: string): any {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") return YAML.parse(text);
  if (ext === ".json") return JSON.parse(text);
  try {
    return YAML.parse(text);
  } catch {
    return JSON.parse(text);
  }
}
