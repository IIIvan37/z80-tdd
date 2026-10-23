import {
  BYTE_REGISTERS,
  type RegisterName,
  type Registers,
  WORD_REGISTERS,
} from "./cpu.ts";
import { hex, isWholeIn } from "./numbers.ts";

/** The hexadecimal digits of each register: 2 for 8 bits, 4 for 16. */
const DIGITS = new Map<string, number>([
  ...BYTE_REGISTERS.map((name) => [name, 2] as const),
  ...WORD_REGISTERS.map((name) => [name, 4] as const),
]);

/** The register as the Z80 manuals write it: `afPrime` is AF'. */
export function registerLabel(name: RegisterName): string {
  return name.replace("Prime", "'").toUpperCase();
}

/** `value` in CPC hexadecimal, as wide as the register `name`. */
export function registerHex(name: RegisterName, value: number): string {
  return hex(value, DIGITS.get(name));
}

/**
 * Fails on a name that is not a register, or a value that is not a whole number as wide as its
 * register. `setter` follows the register in the message, as "Register A of the Stub at #BB5A".
 */
export function checkRegisters(
  values: object,
  setter?: string,
): asserts values is Partial<Registers> {
  const of = setter === undefined ? "" : ` ${setter}`;
  for (const [name, value] of Object.entries(values)) {
    const digits = DIGITS.get(name);
    if (digits === undefined) {
      throw new Error(
        `"${name}" is not a register${of}: the registers are ${[...DIGITS.keys()].join(", ")}`,
      );
    }
    const max = 16 ** digits - 1;
    if (!isWholeIn(value, 0, max)) {
      throw new Error(
        `Register ${registerLabel(name as RegisterName)}${of} cannot be ${value}: it takes ${hex(0, digits)} to ${hex(max, digits)}`,
      );
    }
  }
}

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

export const FLAG_BITS: Readonly<Record<keyof Flags, number>> = {
  s: 0x80,
  z: 0x40,
  y: 0x20,
  h: 0x10,
  x: 0x08,
  pv: 0x04,
  n: 0x02,
  c: 0x01,
};

/** `f` with each of `flags` set or reset. */
export function withFlags(f: number, flags: Partial<Flags>): number {
  let result = f;
  for (const [name, set] of Object.entries(flags) as [keyof Flags, boolean][]) {
    result = set ? result | FLAG_BITS[name] : result & ~FLAG_BITS[name];
  }
  return result;
}

export function flagsOf(f: number): Flags {
  const entries = Object.entries(FLAG_BITS).map(([name, bit]) => [
    name,
    (f & bit) !== 0,
  ]);
  return Object.fromEntries(entries) as Flags;
}
