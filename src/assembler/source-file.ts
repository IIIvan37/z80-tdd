import { stat } from "node:fs/promises";
import { resolve } from "node:path";

/** The path of `source` from the project root; fails when no file is there, a folder included. */
export async function sourceFile(
  source: string,
  root: string,
): Promise<string> {
  const file = resolve(root, source);
  const isFile = await stat(file).then(
    (entry) => entry.isFile(),
    () => false,
  );
  if (!isFile) throw new Error(`The source file "${source}" does not exist`);
  return file;
}
