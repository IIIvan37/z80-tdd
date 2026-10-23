import type { Assembler } from "./assembler/index.ts";
import { type Run, type RunOptions, run } from "./run.ts";

export interface Program {
  /** The address of `label`; fails if the Program has no such label. */
  label(label: string): number;
  run(label: string, options?: RunOptions): Run;
}

export interface LoadProgramOptions {
  readonly source: string;
  readonly assembler: Assembler;
}

/** Assembles `source` and loads it at its real addresses into a 64 KB image. */
export async function loadProgram({
  source,
  assembler,
}: LoadProgramOptions): Promise<Program> {
  const assembly = await assembler.assemble(source);
  const image = new Uint8Array(0x10000);
  for (const block of assembly.blocks) {
    image.set(block.bytes, block.address);
  }

  const addressOf = (label: string): number => {
    const address = assembly.symbols[label];
    if (address === undefined) {
      throw new Error(`The Program has no label "${label}"`);
    }
    return address;
  };

  return {
    label: addressOf,
    run: (label, options) => run(image, addressOf(label), options),
  };
}
