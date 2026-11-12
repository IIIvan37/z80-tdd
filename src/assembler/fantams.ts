import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import type { Assembler, Block } from "./assembler.ts";
import { sourceFile } from "./source-file.ts";

const execFileAsync = promisify(execFile);

// The first line of a .fo object; a reader of version 2 refuses any other.
const HEADER = /^fantams-object (\S+)\n/;
// A fragment of the .fo object: `addr=` is where its bytes are stored, before
// `logical=`, where they run. Its `data` lines follow until `end`.
const FRAGMENT =
  /^fragment \d+ .*\baddr=(0x[0-9A-F]+)\b.*\n((?: {2}.*\n)*)end$/gm;
// A section without ORG, whose address the linker gives, or a relocation,
// whose bytes it writes: an extern symbol, or a jump into such a section.
const NEEDS_LINKER = /^(?:fragment .* unplaced |reloc )/m;
// A fragment stored in a bank; `bank=-1` is the main 64 KB.
const BANKED = /^fragment .* bank=(?!-1\b)/m;
// Labels and EQU symbols; FantAMS writes no variable.
const SYMBOL_LINE =
  /^symbol "((?:[^"\\]|\\.)*)" (?:label|const) .*\bvalue=(-?0x[0-9A-F]+)\b/gm;
// `<file>:<line>: error: <message>`, or `error (preproc):`; warnings left out.
const ERROR_LINE = /^.+:\d+: error\b.*$/gm;
// No release to download: FantAMS is built from its sources.
const REPOSITORY = "https://github.com/sikorama/fantams";

/** What `execFile` rejects with. */
interface FantamsError {
  readonly code?: unknown;
  readonly message: string;
  readonly stderr?: string;
}

export interface FantamsOptions {
  /** Where the `fantams` binary is, from the project root; by default, `fantams` on the PATH. */
  readonly path?: string;
}

/** An Assembler that runs FantAMS on a source file and reads its `.fo` object. */
export function fantamsAssembler({
  path = "fantams",
}: FantamsOptions = {}): Assembler {
  return {
    async assemble(source, root) {
      // fantams runs in the source file's folder: a path with a folder in it
      // must not resolve from there, and a bare name stays a PATH lookup.
      const command = path === basename(path) ? path : resolve(root, path);
      const file = await sourceFile(source, root);
      const dir = await mkdtemp(join(tmpdir(), "z80-tdd-fantams-"));
      try {
        const object = join(dir, "program.fo");
        // FantAMS opens every INCLUDE from the folder it runs in.
        await execFileAsync(command, [file, "-o", object], {
          cwd: dirname(file),
        }).catch((error: FantamsError) => {
          throw failureOf(error, path, source);
        });
        const text = await readFile(object, "utf8");
        const version = text.match(HEADER)?.[1];
        if (version !== "2") {
          throw new Error(
            `FantAMS wrote a .fo object of version ${version ?? "unknown"} for ${source}: z80-tdd reads version 2`,
          );
        }
        if (NEEDS_LINKER.test(text)) {
          throw new Error(
            `FantAMS cannot assemble ${source} without its linker: z80-tdd needs an ORG for each section and no extern symbol`,
          );
        }
        if (BANKED.test(text)) {
          throw new Error(
            `FantAMS stored bytes of ${source} in a bank: z80-tdd loads only the main 64 KB`,
          );
        }
        return { blocks: blocksOf(text), symbols: symbolsOf(text) };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

function failureOf(error: FantamsError, path: string, source: string): Error {
  if (error.code === "ENOENT") {
    return new Error(
      `FantAMS was not found at "${path}": build it from ${REPOSITORY}, then put it on the PATH or give its path`,
    );
  }
  const output = (error.stderr ?? "").trim();
  const errors = output.match(ERROR_LINE) ?? [];
  // Without a line to point at, what fantams said, or why it did not run.
  const reason =
    errors.length > 0 ? errors.join("\n") : output || error.message;
  return new Error(`FantAMS could not assemble ${source}:\n${reason}`);
}

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const [, start, lines] of text.matchAll(FRAGMENT)) {
    let address = Number(start);
    // The block that the next data line extends; a gap ends it.
    let block: { address: number; bytes: number[] } | undefined;
    for (const line of (lines as string).split("\n")) {
      const [kind, ...fields] = line.trim().split(" ");
      if (kind === "data") {
        const [, ...written] = fields; // after the site of the line
        if (block === undefined && written.length > 0) {
          block = { address, bytes: [] };
          blocks.push(block);
        }
        block?.bytes.push(...written.map((byte) => Number.parseInt(byte, 16)));
        address += written.length;
      } else if (kind === "gap") {
        block = undefined;
        address += Number(fields[0]);
      }
    }
  }
  return blocks;
}

function symbolsOf(text: string): Record<string, number> {
  return Object.fromEntries(
    // parseInt reads -0x10, which Number() does not.
    [...text.matchAll(SYMBOL_LINE)].map(([, name, value]) => [
      name,
      Number.parseInt(value as string, 16),
    ]),
  );
}
