// The augmentation below needs vitest in the program: import its types here rather than count on a test file to.
import type {} from "vitest";
import {
  checkRegisters,
  hex,
  type RegisterName,
  type Registers,
  registerHex,
  registerLabel,
  registerText,
} from "./cpu/index.ts";
import type { MemoryRange } from "./program.ts";
import type { MemoryChange, Run } from "./run.ts";

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
      lines(outside),
      `Memory changed only inside ${span}`,
      `Memory changed outside ${span}:`,
    );
  },

  toLeaveMemoryUnchanged(run: Run) {
    return verdict(
      lines(run.memoryChanges),
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
      ...differing.map(([name]) => registerLabel(name).length),
    );
    return verdict(
      differing.map(
        ([name, value]) =>
          `  ${registerLabel(name).padEnd(width)}  expected ${registerHex(name, value)}, received ${registerHex(name, run.registers[name])}`,
      ),
      `Registers match: ${expectations.map(([name, value]) => registerText(name, value)).join(", ")}`,
      "Registers differ:",
    );
  },
};

// TypeScript refuses these mistakes, but a test in plain JavaScript or with a cast
// must not get a TypeError, nor pass under `.not`.
function checked(expected: Partial<Registers>): [RegisterName, number][] {
  const entries = Object.entries(expected);
  if (entries.length === 0) {
    throw new Error(
      "toHaveRegisters() names no register: give at least one, as { a: 0x2a }",
    );
  }
  checkRegisters(expected);
  return entries as [RegisterName, number][];
}

/** Passes when `failures` is empty; the message lists them otherwise. */
function verdict(failures: readonly string[], passed: string, failed: string) {
  return {
    pass: failures.length === 0,
    message: () =>
      failures.length === 0 ? passed : [failed, ...failures].join("\n"),
  };
}

function lines(changes: readonly MemoryChange[]): string[] {
  return changes.map(
    ({ address, before, after }) =>
      `  ${hex(address)}  ${hex(before, 2)} -> ${hex(after, 2)}`,
  );
}
