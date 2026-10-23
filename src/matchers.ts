// The augmentation below needs vitest in the program: import its types here rather than count on a test file to.
import type {} from "vitest";
import { BYTE_REGISTERS, type Registers } from "./cpu/index.ts";
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
    const named = Object.entries(expected) as [keyof Registers, number][];
    const differ = named.filter(
      ([name, value]) => run.registers[name] !== value,
    );
    const width = Math.max(...named.map(([name]) => labelOf(name).length));
    return {
      pass: differ.length === 0,
      message: () =>
        differ.length === 0
          ? `Registers match: ${named.map(([name, value]) => `${labelOf(name)} ${hexOf(name, value)}`).join(", ")}`
          : [
              "Registers differ:",
              ...differ.map(
                ([name, value]) =>
                  `  ${labelOf(name).padEnd(width)}  expected ${hexOf(name, value)}, received ${hexOf(name, run.registers[name])}`,
              ),
            ].join("\n"),
    };
  },
};

/** The register as the Z80 manuals write it: `afPrime` is AF'. */
function labelOf(name: keyof Registers): string {
  return name.replace("Prime", "'").toUpperCase();
}

function hexOf(name: keyof Registers, value: number): string {
  return hex(
    value,
    (BYTE_REGISTERS as readonly string[]).includes(name) ? 2 : 4,
  );
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
