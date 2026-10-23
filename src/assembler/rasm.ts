import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { promisify, stripVTControlCharacters } from "node:util";
import type { Assembler, Block } from "./assembler.ts";

const execFileAsync = promisify(execFile);

// The -map listing gives which addresses hold bytes, by the address a block
// is stored at, before the one it runs at. It is printed before labels
// resolve, so its bytes are not the final ones, but their counts are.
const MAP_LINE =
  /^\d{3}\|([0-9A-F]{4})(?:\|[0-9A-F]{4}| *)\| ((?:[0-9A-F]{2}(?: |$))+)/gm;
// Labels are `L`, EQU symbols `A`; rasm adds two `A` of its own.
const SYMBOL_LINE =
  /^(?!SYNCHRO |RASM_VERSION )(\S+) #([0-9A-F]+) B\d+ [LA]$/gm;
const ERROR_LINE = /^\[(.+):(\d+)\] (.*)$/gm;
const DOWNLOAD = "https://github.com/EdouardBERGE/rasm/releases";

export interface RasmOptions {
  /** Where the `rasm` binary is, from the working directory; by default, `rasm` on the PATH. */
  readonly path?: string;
}

/** An Assembler that runs RASM on a source file. */
export function rasmAssembler({ path = "rasm" }: RasmOptions = {}): Assembler {
  // rasm runs in a temporary folder: a path with a folder in it must not
  // resolve from there, and a bare name stays a PATH lookup.
  const command = path === basename(path) ? path : resolve(path);
  return {
    async assemble(source) {
      const dir = await mkdtemp(join(tmpdir(), "z80-tdd-rasm-"));
      try {
        // A source with its own SAVE gets no default binary from rasm, so a
        // wrapper includes it and saves the whole 64 KB.
        await writeFile(
          join(dir, "program.asm"),
          ` include ${quoted(resolve(source))}\n save 'memory.bin',0,65536\n`,
        );
        const { stdout } = await execFileAsync(
          command,
          ["program.asm", "-map", "-s", "-sq", "-os", "symbols.txt"],
          { cwd: dir },
        ).catch(
          (error: {
            code?: unknown;
            message: string;
            stdout?: string;
            stderr?: string;
          }) => {
            if (error.code === "ENOENT") {
              throw new Error(
                `RASM was not found at "${path}": download it from ${DOWNLOAD}, then put it on the PATH or give its path`,
              );
            }
            const output = stripVTControlCharacters(
              `${error.stdout ?? ""}\n${error.stderr ?? ""}`,
            ).trim();
            const errors = [...output.matchAll(ERROR_LINE)].map(
              ([, file, line, message]) => `${file}:${line}: ${message}`,
            );
            // Without a line to point at, what rasm said, or why it did not run.
            const reason =
              errors.length > 0 ? errors.join("\n") : output || error.message;
            throw new Error(`RASM could not assemble ${source}:\n${reason}`);
          },
        );
        const memory = await readFile(join(dir, "memory.bin"));
        const symbols = await readFile(join(dir, "symbols.txt"), "utf8");
        return {
          blocks: blocksOf(stripVTControlCharacters(stdout), memory),
          symbols: Object.fromEntries(
            [...symbols.matchAll(SYMBOL_LINE)].map(([, label, address]) => [
              label,
              Number.parseInt(address as string, 16),
            ]),
          ),
        };
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

/** `path` between the quotes RASM takes that it does not hold. */
function quoted(path: string): string {
  if (!path.includes("'")) {
    return `'${path}'`;
  }
  if (!path.includes('"')) {
    return `"${path}"`;
  }
  throw new Error(`RASM cannot include ${path}: its path holds both ' and "`);
}

function blocksOf(map: string, memory: Uint8Array): Block[] {
  const occupied = new Uint8Array(0x10000);
  for (const [, address, bytes] of map.matchAll(MAP_LINE)) {
    const start = Number.parseInt(address as string, 16);
    const length = (bytes as string).trim().split(" ").length;
    occupied.fill(1, start, start + length);
  }
  const blocks: Block[] = [];
  for (let address = 0; address < 0x10000; address++) {
    if (occupied[address] === 1) {
      let end = address;
      while (occupied[end] === 1) {
        end++;
      }
      blocks.push({ address, bytes: [...memory.subarray(address, end)] });
      address = end;
    }
  }
  return blocks;
}
