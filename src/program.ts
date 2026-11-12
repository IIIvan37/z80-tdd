import { type ConfigurationFile, loadSettings } from "./configuration-file.ts";
import { isWholeIn } from "./cpu/index.ts";
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

/** Overrides the configuration file for one test file. */
export type LoadProgramOptions = ConfigurationFile;

/** Assembles the source file of the configuration file, or the test file's, and loads it at its real addresses into 64 KB of memory. */
export async function loadProgram(
  options: LoadProgramOptions = {},
): Promise<Program> {
  const { assembler, source, root, sp, nopLimit, portMask } =
    await loadSettings(options);
  const assembly = await assembler.assemble(source, root);
  const memory = new Uint8Array(0x10000);
  const occupied = new Uint8Array(0x10000);
  for (const block of assembly.blocks) {
    memory.set(block.bytes, block.address);
    occupied.fill(1, block.address, block.address + block.bytes.length);
  }
  // Of several labels at one address, the first in the symbol table.
  const labelAt = new Map<number, string>();
  for (const [label, address] of Object.entries(assembly.symbols)) {
    if (!labelAt.has(address)) {
      labelAt.set(address, label);
    }
  }
  const byAddress = [...labelAt].sort(([a], [b]) => a - b);
  // Labels match whatever their case (ADR 0006): each name, in capitals, gives every label it matches.
  const byName = new Map<string, string[]>();
  for (const label of Object.keys(assembly.symbols)) {
    const name = label.toUpperCase();
    byName.set(name, [...(byName.get(name) ?? []), label]);
  }
  const addressOf = (name: string): number => {
    const labels = byName.get(name.toUpperCase());
    if (labels === undefined) {
      throw new Error(`The Program has no label "${name}"`);
    }
    if (labels.length > 1) {
      throw new Error(
        `The name "${name}" matches several labels of the Program, whatever their case: ${labels.join(", ")}`,
      );
    }
    return assembly.symbols[labels[0] as string] as number;
  };

  const loaded: LoadedProgram = {
    bytes: memory,
    sp,
    nopLimit,
    portMask,
    address: addressOf,
    occupies: (address) => occupied[address] === 1,
    labelNear: (address) => {
      const below = byAddress.findLast(([at]) => at <= address);
      if (below === undefined) {
        return "";
      }
      const [at, label] = below;
      return at === address ? label : `${label}+${address - at}`;
    },
  };

  return {
    address: addressOf,
    range: (label, length) => {
      if (!isWholeIn(length, 1, 0x10000)) {
        throw new Error(
          `A range cannot be ${length} bytes long: it takes 1 to 65,536`,
        );
      }
      return { address: addressOf(label), length };
    },
    run: (label, options) => run(loaded, addressOf(label), options),
  };
}
