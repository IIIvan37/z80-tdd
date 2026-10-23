import type { Assembler } from "./assembler/index.ts";
import { type LoadedProgram, type Run, type RunOptions, run } from "./run.ts";

export interface Program {
  /** The address of `label`; fails if the Program has no such label. */
  address(label: string): number;
  /** The `length` bytes from `label`. */
  range(label: string, length: number): MemoryRange;
  run(label: string, options?: RunOptions): Run;
}

export interface MemoryRange {
  readonly address: number;
  readonly length: number;
}

export interface LoadProgramOptions {
  readonly source: string;
  readonly assembler: Assembler;
}

/** Assembles `source` and loads it at its real addresses into 64 KB of memory. */
export async function loadProgram({
  source,
  assembler,
}: LoadProgramOptions): Promise<Program> {
  const assembly = await assembler.assemble(source);
  const memory = new Uint8Array(0x10000);
  const occupied = new Uint8Array(0x10000);
  for (const block of assembly.blocks) {
    memory.set(block.bytes, block.address);
    occupied.fill(1, block.address, block.address + block.bytes.length);
  }
  const byAddress = Object.entries(assembly.symbols).sort(
    ([, a], [, b]) => a - b,
  );
  const byLabel = new Map(
    Object.entries(assembly.symbols).map(([label, address]) => [
      label.toUpperCase(),
      address,
    ]),
  );
  const addressOf = (label: string): number => {
    const address = byLabel.get(label.toUpperCase());
    if (address === undefined) {
      throw new Error(`The Program has no label "${label}"`);
    }
    return address;
  };

  const loaded: LoadedProgram = {
    bytes: memory,
    address: addressOf,
    occupies: (address) => occupied[address] === 1,
    labelNear: (address) => {
      const below = byAddress.findLast(([, at]) => at <= address);
      if (below === undefined) {
        return "";
      }
      // Of several labels at that address, the first in the symbol table.
      const [label, at] = byAddress.find(([, at]) => at === below[1]) ?? below;
      return at === address ? label : `${label}+${address - at}`;
    },
  };

  return {
    address: addressOf,
    range: (label, length) => {
      if (!(Number.isInteger(length) && length >= 1 && length <= 0x10000)) {
        throw new Error(
          `A range cannot be ${length} bytes long: it takes 1 to 65,536`,
        );
      }
      return { address: addressOf(label), length };
    },
    run: (label, options) => run(loaded, addressOf(label), options),
  };
}
