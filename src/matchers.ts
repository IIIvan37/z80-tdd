// The augmentation below needs vitest in the program: import its types here rather than count on a test file to.
import type {} from "vitest";
import { BYTE_REGISTERS, type Registers, WORD_REGISTERS } from "./cpu/index.ts";
import type { MemoryRange } from "./program.ts";
import { hex, type MemoryChange, type Run } from "./run.ts";

declare module "vitest" {
  // The type parameters must match Vitest's own declaration of Matchers.
  interface Matchers<
    R extends void | Promise<void> = void | Promise<void>,
    T = unknown,
  > {
    /** Passes when every Memory change of the Run lies inside `range`. */
    toChangeOnly(range: MemoryRange): R;
    /** Passes when the Run has no Memory change. */
    toLeaveMemoryUnchanged(): R;
    /** Passes when each register named in `expected` holds its value after the Run. */
    toHaveRegisters(expected: Partial<Registers>): R;
  }
}

/** The Vitest matchers on a Run; install them with `expect.extend(runMatchers)`. */
export const runMatchers = {
  toChangeOnly(run: Run, range: MemoryRange) {
    const outside = run.memoryChanges.filter(
      ({ address }) => ((address - range.address) & 0xffff) >= range.length,
    );
    const span = `${hex(range.address)}-${hex((range.address + range.length - 1) & 0xffff)}`;
    return verdict(
      outside,
      `Memory changed only inside ${span}`,
      `Memory changed outside ${span}:`,
    );
  },

  toLeaveMemoryUnchanged(run: Run) {
    return verdict(
      run.memoryChanges,
      "Memory did not change",
      "Memory changed:",
    );
  },

  toHaveRegisters(run: Run, expected: Partial<Registers>) {
    const expectations = checked(expected);
    const differing = expectations.filter(
      ([name, value]) => run.registers[name] !== value,
    );
    const width = Math.max(
      ...expectations.map(([name]) => labelOf(name).length),
    );
    return {
      pass: differing.length === 0,
      message: () =>
        differing.length === 0
          ? `Registers match: ${expectations.map(([name, value]) => `${labelOf(name)} ${hexOf(name, value)}`).join(", ")}`
          : [
              "Registers differ:",
              ...differing.map(
                ([name, value]) =>
                  `  ${labelOf(name).padEnd(width)}  expected ${hexOf(name, value)}, received ${hexOf(name, run.registers[name])}`,
              ),
            ].join("\n"),
    };
  },
};

/** The hexadecimal digits of each register: 2 for 8 bits, 4 for 16. */
const DIGITS = new Map<string, number>([
  ...BYTE_REGISTERS.map((name) => [name, 2] as const),
  ...WORD_REGISTERS.map((name) => [name, 4] as const),
]);

// TypeScript refuses these mistakes, but a test in plain JavaScript or with a cast
// must not get a TypeError, nor pass under `.not`.
function checked(expected: Partial<Registers>): [keyof Registers, number][] {
  const entries = Object.entries(expected);
  if (entries.length === 0) {
    throw new Error(
      "toHaveRegisters() names no register: give at least one, as { a: 0x2a }",
    );
  }
  for (const [name, value] of entries) {
    const digits = DIGITS.get(name);
    if (digits === undefined) {
      throw new Error(
        `"${name}" is not a register: the registers are ${[...DIGITS.keys()].join(", ")}`,
      );
    }
    if (!Number.isInteger(value) || value < 0 || value >= 16 ** digits) {
      throw new Error(
        `${labelOf(name as keyof Registers)} cannot be ${value}: it takes ${digits === 2 ? "a byte, #00 to #FF" : "a word, #0000 to #FFFF"}`,
      );
    }
  }
  return entries as [keyof Registers, number][];
}

/** The register as the Z80 manuals write it: `afPrime` is AF'. */
function labelOf(name: keyof Registers): string {
  return name.replace("Prime", "'").toUpperCase();
}

function hexOf(name: keyof Registers, value: number): string {
  return hex(value, DIGITS.get(name));
}

/** Passes when `changes` is empty; the message names each change otherwise. */
function verdict(
  changes: readonly MemoryChange[],
  passed: string,
  failed: string,
) {
  return {
    pass: changes.length === 0,
    message: () =>
      changes.length === 0 ? passed : [failed, ...lines(changes)].join("\n"),
  };
}

function lines(changes: readonly MemoryChange[]): string[] {
  return changes.map(
    ({ address, before, after }) =>
      `  ${hex(address)}  ${hex(before, 2)} -> ${hex(after, 2)}`,
  );
}
