// Contract test of the CPU against SingleStepTests/z80 (spec story 58, ADR 0004).
// Run it with `pnpm test:core`, which fetches the suite first; `pnpm test` leaves it out.
// Each case runs one instruction. The suite's `ei` and `p` fields are not compared:
// they only matter when an interrupt is accepted, and the tool has no interrupts.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type Cpu,
  createCpu,
  type Internals,
  type Registers,
} from "./index.ts";

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
  readonly wz: number;
  readonly ix: number;
  readonly iy: number;
  readonly af_: number;
  readonly bc_: number;
  readonly de_: number;
  readonly hl_: number;
  readonly im: number;
  readonly iff1: number;
  readonly iff2: number;
  readonly q: number;
  readonly ram: readonly (readonly [number, number])[];
}

type Port = readonly [address: number, value: number];

interface Case {
  readonly name: string;
  readonly initial: State;
  readonly final: State;
  readonly ports?: readonly (readonly [...Port, "r" | "w"])[];
}

/** What a case observes: every register, the internal state, the RAM it lists, and port activity. */
type Observed = Readonly<Record<string, unknown>>;

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

/** The suite has no HALT state: a case starts with the CPU running, and its end state is not compared. */
function internalsOf(state: State): Omit<Internals, "halted"> {
  return {
    wz: state.wz,
    iff1: state.iff1 !== 0,
    iff2: state.iff2 !== 0,
    im: state.im,
    q: state.q,
  };
}

function portsOf(test: Case, kind: "r" | "w"): Port[] {
  return (test.ports ?? [])
    .filter((port) => port[2] === kind)
    .map(([address, value]) => [address, value]);
}

/** The state a case ends in, from the suite or from the CPU. */
interface End {
  readonly registers: Partial<Registers>;
  readonly internals: Omit<Internals, "halted">;
  readonly ram: (address: number) => number | undefined;
  readonly portReads: readonly Port[];
  readonly portWrites: readonly Port[];
  /** Addresses outside the case's RAM list whose byte is no longer zero. */
  readonly strayWrites: readonly number[];
}

function observe(test: Case, end: End): Observed {
  return {
    ...Object.fromEntries(
      Object.keys(registersOf(test.final)).map((name) => [
        name,
        end.registers[name as keyof Registers],
      ]),
    ),
    ...end.internals,
    ...Object.fromEntries(
      test.final.ram.map(([address]) => [`ram ${address}`, end.ram(address)]),
    ),
    portReads: end.portReads,
    portWrites: end.portWrites,
    strayWrites: end.strayWrites,
  };
}

function expected(test: Case): Observed {
  const ram = new Map(test.final.ram);
  return observe(test, {
    registers: registersOf(test.final),
    internals: internalsOf(test.final),
    ram: (address) => ram.get(address),
    portReads: portsOf(test, "r"),
    portWrites: portsOf(test, "w"),
    strayWrites: [],
  });
}

const ZERO = Buffer.alloc(0x10000);

/**
 * Memory starts at zero outside the case's RAM list, so a write elsewhere shows as a
 * non-zero byte once the listed addresses are cleared (a stray zero goes unseen).
 */
function strayWrites(memory: Uint8Array, test: Case): number[] {
  for (const [address] of [...test.initial.ram, ...test.final.ram]) {
    memory[address] = 0;
  }
  if (Buffer.from(memory.buffer, memory.byteOffset, 0x10000).equals(ZERO)) {
    return [];
  }
  return [...memory.keys()].filter((address) => memory[address] !== 0);
}

/** One CPU for every case of a file; each case resets the memory and state. */
function caseRunner(): (test: Case) => Observed {
  let supplied: Port[] = [];
  let portReads: Port[] = [];
  let portWrites: Port[] = [];
  const cpu: Cpu = createCpu({
    read: (address) => {
      const value = supplied[portReads.length]?.[1] ?? 0xff;
      portReads.push([address, value]);
      return value;
    },
    write: (address, value) => {
      portWrites.push([address, value]);
    },
  });

  return (test) => {
    cpu.memory.fill(0);
    for (const [address, value] of test.initial.ram) {
      cpu.memory[address] = value;
    }
    supplied = portsOf(test, "r");
    portReads = [];
    portWrites = [];
    cpu.setRegisters(registersOf(test.initial));
    cpu.setInternals({ ...internalsOf(test.initial), halted: false });

    cpu.step();

    const { halted: _, ...internals } = cpu.internals();
    const ram = new Map(
      test.final.ram.map(([address]) => [address, cpu.memory[address]]),
    );
    return observe(test, {
      registers: cpu.registers(),
      internals,
      ram: (address) => ram.get(address),
      portReads,
      portWrites,
      strayWrites: strayWrites(cpu.memory, test),
    });
  };
}

/** The fields of `test` where the CPU disagrees with the suite. */
function mismatches(test: Case, runCase: (test: Case) => Observed): string[] {
  const want = expected(test);
  const got = runCase(test);
  return Object.keys(want)
    .filter(
      (field) => JSON.stringify(want[field]) !== JSON.stringify(got[field]),
    )
    .map(
      (field) =>
        `${test.name}: ${field} is ${JSON.stringify(got[field])}, expected ${JSON.stringify(want[field])}`,
    );
}

const files = readdirSync(SUITE_DIR)
  .filter((file) => file.endsWith(".json"))
  .sort();

describe("the CPU against SingleStepTests/z80", () => {
  it("finds the whole suite", () => {
    expect(files.length).toBe(1604);
  });

  it.each(files)("%s", (file) => {
    const tests = JSON.parse(
      readFileSync(join(SUITE_DIR, file), "utf8"),
    ) as Case[];
    const runCase = caseRunner();

    const failures = tests.flatMap((test) => mismatches(test, runCase));

    expect(failures.slice(0, 5), `${failures.length} mismatches`).toEqual([]);
  });
});
