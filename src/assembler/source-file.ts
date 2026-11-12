import { access } from "node:fs/promises";
import { resolve } from "node:path";

/** The path of `source` from the project root; fails when no file is there. */
export async function sourceFile(
  source: string,
  root: string,
): Promise<string> {
  const file = resolve(root, source);
  await access(file).catch(() => {
    throw new Error(`The source file "${source}" does not exist`);
  });
  return file;
}
