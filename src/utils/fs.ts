import fs from "node:fs/promises";
import path from "node:path";

export async function mkdirp(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeTextFile(filePath: string, text: string): Promise<void> {
  await mkdirp(path.dirname(filePath));
  await fs.writeFile(filePath, text, "utf8");
}
