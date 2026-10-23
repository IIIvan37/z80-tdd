// The build leaves out the tests, so this brings in the vitest types the augmentation below needs.
import type {} from "vitest";
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
  }
}

/** The Vitest matchers on a Run; install them with `expect.extend(memoryMatchers)`. */
export const memoryMatchers = {
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
};

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
