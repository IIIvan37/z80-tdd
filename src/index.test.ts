import { describe, expect, it } from "vitest";
import {
  type Assembly,
  type Flags,
  inMemoryAssembler,
  loadProgram,
  type StartRegisters,
} from "./index.ts";

const NOP = 0x00;
const LD_A_N = 0x3e;
const RET = 0xc9;
const ADD_A_B = 0x80;
const ADC_A_N = 0xce;
const SUB_A = 0x97;
const EXX = 0xd9;
const EX_AF_AF = 0x08;
const ADD_HL_BC = 0x09;
const LD_A_FROM_NN = 0x3a;
const LD_NN_FROM_A = 0x32;
const OR_A = 0xb7;
const RET_Z = 0xc8;
const JP_NN = 0xc3;

function load(assembly: Assembly) {
  return loadProgram({
    source: "main.asm",
    assembler: inMemoryAssembler({ "main.asm": assembly }),
  });
}

describe("a Program", () => {
  it("fails to run a label it does not have, naming the label", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { set_a: 0x4000 },
    });

    expect(() => program.run("set_b")).toThrow(/set_b/);
  });

  it("gives the address of a label", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { set_a: 0x4000, buffer: 0x5000 },
    });

    expect(program.address("buffer")).toBe(0x5000);
  });
});

describe("a Run", () => {
  it("gives the registers the Routine leaves behind", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_N, 5, RET] }],
      symbols: { set_a: 0x4000 },
    });

    const run = program.run("set_a");

    expect(run.registers.a).toBe(5);
  });

  it("starts with the registers the test sets", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ADD_A_B, RET] }],
      symbols: { add: 0x4000 },
    });

    const run = program.run("add", { registers: { a: 2, b: 3 } });

    expect(run.registers.a).toBe(5);
  });

  it("calls the Routine with SP at #C000 by default", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    expect(program.run("nothing").registers.sp).toBe(0xc000);
  });

  it("calls the Routine with the SP the test sets", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    const run = program.run("nothing", { registers: { sp: 0x8000 } });

    expect(run.registers.sp).toBe(0x8000);
  });

  it("starts with the flags the test sets", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ADC_A_N, 0, RET] }],
      symbols: { add_carry: 0x4000 },
    });

    const run = program.run("add_carry", {
      registers: { a: 1 },
      flags: { c: true },
    });

    expect(run.registers.a).toBe(2);
  });

  it("gives the flags the Routine leaves behind", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [SUB_A, RET] }],
      symbols: { clear_a: 0x4000 },
    });

    const run = program.run("clear_a", {
      registers: { a: 7 },
      flags: { c: true },
    });

    expect(run.flags.z).toBe(true);
    expect(run.flags.c).toBe(false);
  });

  it("sets and gives 16-bit pairs, IX and the shadow registers", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ADD_HL_BC, EXX, RET] }],
      symbols: { add_and_swap: 0x4000 },
    });

    const run = program.run("add_and_swap", {
      registers: { bc: 0x0102, hl: 0x1000, ix: 0x1234, bcPrime: 0xbeef },
    });

    expect(run.registers.hlPrime).toBe(0x1102);
    expect(run.registers.ix).toBe(0x1234);
    expect(run.registers.bc).toBe(0xbeef);
    expect(run.registers.bcPrime).toBe(0x0102);
  });

  it("applies an 8-bit register after the pair that contains it", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    const run = program.run("nothing", { registers: { c: 0x22, bc: 0x1111 } });

    expect(run.registers.bc).toBe(0x1122);
  });

  it("starts with RAM at zero outside the Program", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_FROM_NN, 0x00, 0x80, RET] }],
      symbols: { read: 0x4000 },
    });

    const run = program.run("read", { registers: { a: 7 } });

    expect(run.registers.a).toBe(0);
  });

  it("ends at whichever RET returns to the caller", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [OR_A, RET_Z, LD_A_N, 9, RET] }],
      symbols: { early_return: 0x4000 },
    });

    expect(
      program.run("early_return", { registers: { a: 0 } }).registers.a,
    ).toBe(0);
    expect(
      program.run("early_return", { registers: { a: 1 } }).registers.a,
    ).toBe(9);
  });

  it("ends when a JP to another routine returns", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [JP_NN, 0x00, 0x50] },
        { address: 0x5000, bytes: [LD_A_N, 3, RET] },
      ],
      symbols: { tail_call: 0x4000, set_three: 0x5000 },
    });

    expect(program.run("tail_call").registers.a).toBe(3);
  });

  it("starts each Run on a fresh machine", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [LD_NN_FROM_A, 0x00, 0x80, RET] },
        { address: 0x4100, bytes: [LD_A_FROM_NN, 0x00, 0x80, RET] },
      ],
      symbols: { write: 0x4000, read: 0x4100 },
    });

    program.run("write", { registers: { a: 5 } });

    expect(program.run("read").registers.a).toBe(0);
  });

  it("gives a frozen result", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    const run = program.run("nothing");

    expect(Object.isFrozen(run)).toBe(true);
    expect(Object.isFrozen(run.registers)).toBe(true);
    expect(Object.isFrozen(run.flags)).toBe(true);
  });

  it("wraps the stack below SP #0000 to the top of memory", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_N, 5, RET] }],
      symbols: { set_a: 0x4000 },
    });

    const run = program.run("set_a", { registers: { sp: 0x0000 } });

    expect(run.registers.a).toBe(5);
    expect(run.registers.sp).toBe(0x0000);
  });

  it("wraps the sentinel across the top of memory when SP is #0001", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_N, 5, RET] }],
      symbols: { set_a: 0x4000 },
    });

    const run = program.run("set_a", { registers: { sp: 0x0001 } });

    expect(run.registers.a).toBe(5);
    expect(run.registers.sp).toBe(0x0001);
  });

  it("does not end when PC reaches the return address without returning", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [LD_A_N, 1, JP_NN, 0xff, 0xff] },
        { address: 0xffff, bytes: [RET] },
      ],
      symbols: { jump_to_top: 0x4000 },
    });

    const run = program.run("jump_to_top");

    expect(run.registers.sp).toBe(0xc000);
  });

  it("fails rather than push the return address over the Program", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [RET] },
        { address: 0xbffe, bytes: [0x12, 0x34] },
      ],
      symbols: { nothing: 0x4000 },
    });

    expect(() => program.run("nothing")).toThrow(/#BFFE/);
  });

  it("fails on a register value too wide for the register, naming it", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    expect(() =>
      program.run("nothing", { registers: { bc: 0x12345 } }),
    ).toThrow(/bc/);
    expect(() => program.run("nothing", { registers: { a: 0x100 } })).toThrow(
      /\ba\b/,
    );
    expect(() => program.run("nothing", { registers: { h: -1 } })).toThrow(
      /\bh\b/,
    );
  });

  it("refuses a PC set by the test, since the Run starts at the entry label", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    // @ts-expect-error PC is not a register the test may set
    expect(() => program.run("nothing", { registers: { pc: 0x1234 } })).toThrow(
      /pc/,
    );
  });

  it("sets and gives IY, the halves of IX and every shadow register", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [EX_AF_AF, EXX, RET] }],
      symbols: { swap_all: 0x4000 },
    });

    const run = program.run("swap_all", {
      registers: {
        af: 0x1111,
        bc: 0x2222,
        de: 0x3333,
        hl: 0x4444,
        afPrime: 0xaaaa,
        bcPrime: 0xbbbb,
        dePrime: 0xcccc,
        hlPrime: 0xdddd,
        iy: 0x5678,
        ixh: 0x12,
        ixl: 0x34,
      },
    });

    expect(run.registers).toMatchObject({
      af: 0xaaaa,
      bc: 0xbbbb,
      de: 0xcccc,
      hl: 0xdddd,
      afPrime: 0x1111,
      bcPrime: 0x2222,
      dePrime: 0x3333,
      hlPrime: 0x4444,
      iy: 0x5678,
      ix: 0x1234,
    });
  });
});

describe("the duration of a Run", () => {
  it("counts the final RET, and 5 NOPs more with the CALL", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    const run = program.run("nothing");

    expect(run.nops).toBe(3);
    expect(run.nopsWithCall).toBe(8);
  });

  it("adds up the NOPs of every instruction executed", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [NOP, LD_A_N, 5, RET] }],
      symbols: { set_a: 0x4000 },
    });

    expect(program.run("set_a").nops).toBe(1 + 2 + 3);
  });
});

// The NOPs of each unprefixed instruction, from Madram / Overlanders, "Perfectly accurate Z80
// flags and CPC timing". Each case runs `code` then a RET; `nops` is the whole Run. A jump, CALL
// or RST lands on a RET at #5000 or at the RST address.
interface TimingCase {
  readonly name: string;
  readonly code: readonly number[];
  readonly nops: number;
  readonly registers?: StartRegisters;
  readonly flags?: Partial<Flags>;
}

const RET_NOPS = 3;
const TARGET = [0x00, 0x50];
const SP_AFTER_CALL = [0xfe, 0xbf];
const REGISTER_CODES = [0, 1, 2, 3, 4, 5, 7]; // B C D E H L A; 6 is (HL)

const each = (
  name: string,
  opcodes: readonly number[],
  nops: number,
  operands: readonly number[] = [],
): TimingCase[] =>
  opcodes.map((opcode) => ({
    name: `${name} (#${opcode.toString(16).toUpperCase().padStart(2, "0")})`,
    code: [opcode, ...operands],
    nops,
  }));

const withRegisterIn = (base: number, shift: number) =>
  REGISTER_CODES.map((r) => base | (r << shift));
const withPairIn = (base: number) => [0, 1, 2, 3].map((rr) => base | (rr << 4));
const withAluIn = (base: number) =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((op) => base | (op << 3));

const LD_R_R = REGISTER_CODES.flatMap((to) =>
  REGISTER_CODES.map((from) => 0x40 | (to << 3) | from),
);

const FIXED_TIMINGS: readonly TimingCase[] = [
  ...each("nop", [0x00], 1 + RET_NOPS),
  ...each("ld rr,nn", [0x01, 0x11, 0x21], 3 + RET_NOPS, TARGET),
  ...each("ld sp,nn", [0x31], 3 + RET_NOPS, SP_AFTER_CALL),
  ...each("ld (bc),a / ld (de),a", [0x02, 0x12], 2 + RET_NOPS),
  ...each("ld a,(bc) / ld a,(de)", [0x0a, 0x1a], 2 + RET_NOPS),
  ...each("inc rr", [0x03, 0x13, 0x23], 2 + RET_NOPS),
  ...each("dec rr", [0x0b, 0x1b, 0x2b], 2 + RET_NOPS),
  { name: "inc sp, dec sp", code: [0x33, 0x3b], nops: 2 + 2 + RET_NOPS },
  ...each("inc r", withRegisterIn(0x04, 3), 1 + RET_NOPS),
  ...each("dec r", withRegisterIn(0x05, 3), 1 + RET_NOPS),
  ...each("inc (hl) / dec (hl)", [0x34, 0x35], 3 + RET_NOPS),
  ...each("ld r,n", withRegisterIn(0x06, 3), 2 + RET_NOPS, [0x12]),
  ...each("ld (hl),n", [0x36], 3 + RET_NOPS, [0x12]),
  ...each("rlca / rrca / rla / rra", [0x07, 0x0f, 0x17, 0x1f], 1 + RET_NOPS),
  ...each("daa / cpl / scf / ccf", [0x27, 0x2f, 0x37, 0x3f], 1 + RET_NOPS),
  ...each("ex af,af'", [0x08], 1 + RET_NOPS),
  ...each("add hl,rr", withPairIn(0x09), 3 + RET_NOPS),
  ...each("jr n", [0x18], 3 + RET_NOPS, [0x00]),
  ...each("ld (nn),hl / ld hl,(nn)", [0x22, 0x2a], 5 + RET_NOPS, [0x00, 0x60]),
  ...each("ld (nn),a / ld a,(nn)", [0x32, 0x3a], 4 + RET_NOPS, [0x00, 0x60]),
  ...each("ld r,r'", LD_R_R, 1 + RET_NOPS),
  ...each("ld r,(hl)", withRegisterIn(0x46, 3), 2 + RET_NOPS),
  ...each("ld (hl),r", withRegisterIn(0x70, 0), 2 + RET_NOPS),
  ...each(
    "alu r",
    withAluIn(0x80).flatMap((op) => withRegisterIn(op, 0)),
    1 + RET_NOPS,
  ),
  ...each("alu (hl)", withAluIn(0x86), 2 + RET_NOPS),
  ...each("alu n", withAluIn(0xc6), 2 + RET_NOPS, [0x12]),
  ...[0xc5, 0xd5, 0xe5, 0xf5].map((push) => ({
    name: `push qq, pop qq (#${push.toString(16).toUpperCase()})`,
    code: [push, push - 4],
    nops: 4 + 3 + RET_NOPS,
  })),
  ...each("jp nn", [0xc3], 3 + RET_NOPS, TARGET),
  ...each("call nn", [0xcd], 5 + RET_NOPS + RET_NOPS, TARGET),
  ...each("rst p", withAluIn(0xc7), 4 + RET_NOPS + RET_NOPS),
  ...each("out (n),a / in a,(n)", [0xd3, 0xdb], 3 + RET_NOPS, [0x12]),
  ...each("exx / ex de,hl / di / ei", [0xd9, 0xeb, 0xf3, 0xfb], 1 + RET_NOPS),
  {
    name: "ex (sp),hl, ex (sp),hl",
    code: [0xe3, 0xe3],
    nops: 6 + 6 + RET_NOPS,
  },
  {
    name: "jp (hl)",
    code: [0xe9],
    nops: 1 + RET_NOPS,
    registers: { hl: 0x5000 },
  },
  {
    name: "ld sp,hl",
    code: [0xf9],
    nops: 2 + RET_NOPS,
    registers: { hl: 0xbffe },
  },
];

interface Condition {
  readonly name: string;
  readonly met: Partial<Flags>;
  readonly notMet: Partial<Flags>;
}

// In the order of their 3-bit code.
const CONDITIONS: readonly Condition[] = [
  { name: "nz", met: { z: false }, notMet: { z: true } },
  { name: "z", met: { z: true }, notMet: { z: false } },
  { name: "nc", met: { c: false }, notMet: { c: true } },
  { name: "c", met: { c: true }, notMet: { c: false } },
  { name: "po", met: { pv: false }, notMet: { pv: true } },
  { name: "pe", met: { pv: true }, notMet: { pv: false } },
  { name: "p", met: { s: false }, notMet: { s: true } },
  { name: "m", met: { s: true }, notMet: { s: false } },
];

const conditional = (
  name: string,
  opcodeOf: (cc: number) => number,
  operands: readonly number[],
  nops: { readonly met: number; readonly notMet: number },
  conditions = CONDITIONS,
): TimingCase[] =>
  conditions.flatMap((condition, code) =>
    (["met", "notMet"] as const).map((outcome) => ({
      name: `${name.replace("cc", condition.name)}, ${outcome === "met" ? "met" : "not met"}`,
      code: [opcodeOf(code), ...operands],
      nops: nops[outcome],
      flags: condition[outcome],
    })),
  );

const CONDITIONAL_TIMINGS: readonly TimingCase[] = [
  ...conditional(
    "jr cc,n",
    (cc) => 0x20 | (cc << 3),
    [0x00],
    { met: 3 + RET_NOPS, notMet: 2 + RET_NOPS },
    CONDITIONS.slice(0, 4),
  ),
  ...conditional("jp cc,nn", (cc) => 0xc2 | (cc << 3), TARGET, {
    met: 3 + RET_NOPS,
    notMet: 3 + RET_NOPS,
  }),
  ...conditional("call cc,nn", (cc) => 0xc4 | (cc << 3), TARGET, {
    met: 5 + RET_NOPS + RET_NOPS,
    notMet: 3 + RET_NOPS,
  }),
  ...conditional("ret cc", (cc) => 0xc0 | (cc << 3), [], {
    met: 4,
    notMet: 2 + RET_NOPS,
  }),
  {
    name: "djnz n, jumping",
    code: [0x10, 0x00],
    nops: 4 + RET_NOPS,
    registers: { b: 2 },
  },
  {
    name: "djnz n, B reaching 0",
    code: [0x10, 0x00],
    nops: 3 + RET_NOPS,
    registers: { b: 1 },
  },
];

function loadTimingCase(code: readonly number[]) {
  const rstTargets = Array.from({ length: 0x39 }, (_, address) =>
    address % 8 === 0 ? RET : 0,
  );
  return load({
    blocks: [
      { address: 0x0000, bytes: rstTargets },
      { address: 0x4000, bytes: [...code, RET] },
      { address: 0x5000, bytes: [RET] },
    ],
    symbols: { code: 0x4000 },
  });
}

describe("the NOPs of an unprefixed instruction", () => {
  it.each([...FIXED_TIMINGS, ...CONDITIONAL_TIMINGS])(
    "runs $name in $nops NOPs, RET included",
    async (timing) => {
      const program = await loadTimingCase(timing.code);

      const run = program.run("code", timing);

      expect(run.nops).toBe(timing.nops);
    },
  );
});

describe("a Run reaching a prefixed instruction", () => {
  it.each(["CB", "DD", "ED", "FD"])(
    "fails, naming the prefix #%s and its address, rather than count zero",
    async (prefix) => {
      const program = await loadTimingCase([NOP, Number(`0x${prefix}`), 0x00]);

      expect(() => program.run("code")).toThrow(
        new RegExp(`#${prefix}.*#4001`),
      );
    },
  );
});
