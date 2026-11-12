// Compares the NOPs of nops.ts with the cell80 clock on every case of SingleStepTests/z80
// (ADR 0002). Run it with `pnpm test:core`, which fetches the suite first.
// SUITE_DIR, State and registersOf copy src/cpu/single-step-tests.test.ts: keep them in step.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createCpu, type Registers } from "./cpu/index.ts";
import { nopsOf } from "./nops.ts";

const SUITE_DIR = ".cache/single-step-tests/v1";

interface State {
  readonly pc: number;
  readonly sp: number;
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly e: number;
  readonly f: number;
  readonly h: number;
  readonly l: number;
  readonly i: number;
  readonly r: number;
  readonly ix: number;
  readonly iy: number;
  readonly af_: number;
  readonly bc_: number;
  readonly de_: number;
  readonly hl_: number;
  readonly ram: readonly (readonly [number, number])[];
}

interface Case {
  readonly initial: State;
}

function registersOf(state: State): Partial<Registers> {
  return {
    af: (state.a << 8) | state.f,
    bc: (state.b << 8) | state.c,
    de: (state.d << 8) | state.e,
    hl: (state.h << 8) | state.l,
    afPrime: state.af_,
    bcPrime: state.bc_,
    dePrime: state.de_,
    hlPrime: state.hl_,
    ix: state.ix,
    iy: state.iy,
    sp: state.sp,
    pc: state.pc,
    i: state.i,
    r: state.r,
  };
}

// Where the table and the clock differ, as measured on 2026-10-24: one line per
// instruction of the suite, its NOPs in nops.ts, then by the clock. The table is
// right for the CPC (ADR 0002); the clock's alignment rule misses these.
const KNOWN_DIFFERENCES: readonly string[] = [
  // IN r,(C) and OUT (C),r, IN F,(C) and OUT (C),0 included (Madram's table 4, model 3).
  "ed 40: nops.ts 4, cell80 3",
  "ed 41: nops.ts 4, cell80 3",
  "ed 48: nops.ts 4, cell80 3",
  "ed 49: nops.ts 4, cell80 3",
  "ed 50: nops.ts 4, cell80 3",
  "ed 51: nops.ts 4, cell80 3",
  "ed 58: nops.ts 4, cell80 3",
  "ed 59: nops.ts 4, cell80 3",
  "ed 60: nops.ts 4, cell80 3",
  "ed 61: nops.ts 4, cell80 3",
  "ed 68: nops.ts 4, cell80 3",
  "ed 69: nops.ts 4, cell80 3",
  "ed 70: nops.ts 4, cell80 3",
  "ed 71: nops.ts 4, cell80 3",
  "ed 78: nops.ts 4, cell80 3",
  "ed 79: nops.ts 4, cell80 3",
  // OTIR and OTDR when they repeat (Madram's table 6, model 7).
  "ed b3: nops.ts 6, cell80 7",
  "ed bb: nops.ts 6, cell80 7",
];

const files = readdirSync(SUITE_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort();

describe("nops.ts against the cell80 clock", () => {
  const cpu = createCpu();

  it.each(files)("%s", (file) => {
    const instruction = file.replace(/\.json$/, "");
    const cases = JSON.parse(
      readFileSync(join(SUITE_DIR, file), "utf8"),
    ) as Case[];
    const differences = new Set<string>();
    // No memory reset between cases: every byte a step reads is in initial.ram.
    for (const test of cases) {
      for (const [address, value] of test.initial.ram) {
        cpu.memory[address] = value;
      }
      cpu.setRegisters(registersOf(test.initial));
      cpu.setInternals({ halted: false });
      const table = nopsOf(cpu.memory, cpu.registers(), false);
      const before = cpu.elapsedNops();
      cpu.step();
      const clock = cpu.elapsedNops() - before;
      if (table !== clock) {
        differences.add(`${instruction}: nops.ts ${table}, cell80 ${clock}`);
      }
    }

    expect([...differences]).toEqual(
      KNOWN_DIFFERENCES.filter((line) => line.startsWith(`${instruction}:`)),
    );
  });
});
