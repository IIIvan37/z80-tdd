import {
  BYTE_REGISTERS,
  createCpu,
  type Registers,
  WORD_REGISTERS,
} from "./cpu/index.ts";

const DEFAULT_SP = 0xc000;
// The return address pushed for the Routine. The Routine has returned when PC is back here
// with the stack back where it was, so a jump to this address alone does not end the Run.
const SENTINEL = 0xffff;

/** The bits of F. `y` and `x` are the undocumented bits 5 and 3. */
export interface Flags {
  readonly s: boolean;
  readonly z: boolean;
  readonly y: boolean;
  readonly h: boolean;
  readonly x: boolean;
  readonly pv: boolean;
  readonly n: boolean;
  readonly c: boolean;
}

const FLAG_BITS: Readonly<Record<keyof Flags, number>> = {
  s: 0x80,
  z: 0x40,
  y: 0x20,
  h: 0x10,
  x: 0x08,
  pv: 0x04,
  n: 0x02,
  c: 0x01,
};

/** The registers a test may set before a Run: all but PC, which starts at the entry label. */
export type StartRegisters = Partial<Omit<Registers, "pc">>;

export interface RunOptions {
  readonly registers?: StartRegisters;
  /** Applied after `registers`, so they override the matching bits of F. */
  readonly flags?: Partial<Flags>;
}

export interface Run {
  readonly registers: Registers;
  readonly flags: Flags;
}

/** The 64 KB of memory a Program was loaded into. */
export interface LoadedMemory {
  readonly bytes: Uint8Array;
  /** Whether the Program put a byte at `address`. */
  occupies(address: number): boolean;
}

/** Runs the Routine at `entry` on a fresh copy of `loaded` until it returns. */
export function run(
  loaded: LoadedMemory,
  entry: number,
  options: RunOptions = {},
): Run {
  checkWidths(options.registers ?? {});
  const memory = loaded.bytes.slice();
  const cpu = createCpu(memory);

  const callerSp = options.registers?.sp ?? DEFAULT_SP;
  const sp = (callerSp - 2) & 0xffff;
  for (const [address, byte] of [
    [sp, SENTINEL & 0xff],
    [(sp + 1) & 0xffff, SENTINEL >> 8],
  ] as const) {
    if (loaded.occupies(address)) {
      throw new Error(
        `The return address pushed at ${hex(address)} would overwrite the Program; set another SP`,
      );
    }
    memory[address] = byte;
  }
  cpu.setRegisters({ ...options.registers, sp, pc: entry });
  cpu.setRegisters({ f: withFlags(cpu.registers().f, options.flags ?? {}) });

  while (!hasReturned(cpu.registers(), callerSp)) {
    cpu.step();
  }

  const registers = Object.freeze(cpu.registers());
  return Object.freeze({
    registers,
    flags: Object.freeze(flagsOf(registers.f)),
  });
}

function checkWidths(registers: StartRegisters): void {
  if ("pc" in registers) {
    throw new Error(
      "Register pc cannot be set: the Run starts at the entry label",
    );
  }
  for (const [names, max] of [
    [WORD_REGISTERS, 0xffff],
    [BYTE_REGISTERS, 0xff],
  ] as const) {
    for (const name of names) {
      const value = (registers as Partial<Registers>)[name];
      if (
        value !== undefined &&
        !(Number.isInteger(value) && value >= 0 && value <= max)
      ) {
        throw new Error(
          `Register ${name} cannot hold ${value}: it takes 0 to ${max}`,
        );
      }
    }
  }
}

function hasReturned({ pc, sp }: Registers, callerSp: number): boolean {
  return pc === SENTINEL && sp === callerSp;
}

function withFlags(f: number, flags: Partial<Flags>): number {
  let result = f;
  for (const [name, set] of Object.entries(flags) as [keyof Flags, boolean][]) {
    result = set ? result | FLAG_BITS[name] : result & ~FLAG_BITS[name];
  }
  return result;
}

function flagsOf(f: number): Flags {
  const entries = Object.entries(FLAG_BITS).map(([name, bit]) => [
    name,
    (f & bit) !== 0,
  ]);
  return Object.fromEntries(entries) as Flags;
}

function hex(address: number): string {
  return `#${address.toString(16).toUpperCase().padStart(4, "0")}`;
}
