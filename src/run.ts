import { createCpu, type Registers } from "./cpu/index.ts";

const DEFAULT_SP = 0xc000;
// The Routine is called from here: reaching it again means the Routine has returned.
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

export interface RunOptions {
  readonly registers?: Partial<Registers>;
  /** Applied after `registers`, so they override the matching bits of F. */
  readonly flags?: Partial<Flags>;
}

export interface Run {
  readonly registers: Registers;
  readonly flags: Flags;
}

/** Runs the Routine at `entry` on a fresh copy of `image` (64 KB) until it returns. */
export function run(
  image: Uint8Array,
  entry: number,
  options: RunOptions = {},
): Run {
  const memory = image.slice();
  const cpu = createCpu(memory);

  const sp = (options.registers?.sp ?? DEFAULT_SP) - 2;
  memory[sp] = SENTINEL & 0xff;
  memory[sp + 1] = SENTINEL >> 8;
  cpu.setRegisters({ ...options.registers, sp, pc: entry });
  cpu.setRegisters({ f: withFlags(cpu.registers().f, options.flags ?? {}) });

  while (cpu.registers().pc !== SENTINEL) {
    cpu.step();
  }

  const registers = Object.freeze(cpu.registers());
  return Object.freeze({
    registers,
    flags: Object.freeze(flagsOf(registers.f)),
  });
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
