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

  it("finds a label whatever its case", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { BUFFER: 0x5000 },
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
    ).toThrow("Register BC cannot be 74565: it takes #0000 to #FFFF");
    expect(() => program.run("nothing", { registers: { a: 0x100 } })).toThrow(
      "Register A cannot be 256: it takes #00 to #FF",
    );
    expect(() => program.run("nothing", { registers: { h: -1 } })).toThrow(
      "Register H cannot be -1: it takes #00 to #FF",
    );
  });

  it("fails on a name that is not a register, rather than ignore it", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    expect(() =>
      program.run("nothing", { registers: { HL: 0x1234 } as never }),
    ).toThrow('"HL" is not a register: the registers are a, f, b, c,');
  });

  it("fails on a register left undefined, rather than leave it at zero", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    expect(() =>
      program.run("nothing", { registers: { a: undefined } as never }),
    ).toThrow("Register A cannot be undefined: it takes #00 to #FF");
  });

  it("refuses a PC set by the test, since the Run starts at the entry label", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    // @ts-expect-error PC is not a register the test may set
    expect(() => program.run("nothing", { registers: { pc: 0x1234 } })).toThrow(
      "Register PC cannot be set: the Run starts at the entry label",
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

const hexBytes = (bytes: readonly number[]) =>
  bytes
    .map((byte) => byte.toString(16).toUpperCase().padStart(2, "0"))
    .join("");

const each = (
  name: string,
  opcodes: readonly number[],
  nops: number,
  operands: readonly number[] = [],
): TimingCase[] =>
  opcodes.map((opcode) => ({
    name: `${name} (#${hexBytes([opcode])})`,
    code: [opcode, ...operands],
    nops,
  }));

const withRegisterIn = (base: number, shift: number) =>
  REGISTER_CODES.map((r) => base | (r << shift));
const withPairIn = (base: number) => [0, 1, 2, 3].map((rr) => base | (rr << 4));
const withBits3To5In = (base: number) =>
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
    withBits3To5In(0x80).flatMap((op) => withRegisterIn(op, 0)),
    1 + RET_NOPS,
  ),
  ...each("alu (hl)", withBits3To5In(0x86), 2 + RET_NOPS),
  ...each("alu n", withBits3To5In(0xc6), 2 + RET_NOPS, [0x12]),
  ...[0xc5, 0xd5, 0xe5, 0xf5].map((push) => ({
    name: `push qq, pop qq (#${hexBytes([push])})`,
    code: [push, push - 4],
    nops: 4 + 3 + RET_NOPS,
  })),
  ...each("jp nn", [0xc3], 3 + RET_NOPS, TARGET),
  ...each("call nn", [0xcd], 5 + RET_NOPS + RET_NOPS, TARGET),
  ...each("rst p", withBits3To5In(0xc7), 4 + RET_NOPS + RET_NOPS),
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

async function runsInItsNops(timing: TimingCase) {
  const program = await loadTimingCase(timing.code);

  // Under the port mask 0, the one port 0 answers every IN.
  const run = program.run("code", {
    ...timing,
    portMask: 0,
    ports: { 0: () => 0xff },
  });

  expect(run.nops).toBe(timing.nops);
}

describe("the NOPs of an unprefixed instruction", () => {
  it.each([...FIXED_TIMINGS, ...CONDITIONAL_TIMINGS])(
    "runs $name in $nops NOPs, RET included",
    runsInItsNops,
  );
});

// Keep memory accesses and block instructions away from the code.
const POINTERS: StartRegisters = { bc: 0x0005, de: 0x7000, hl: 0x6000 };

// Like `each`, for opcodes behind the `prefix` bytes.
const eachPrefixed = (
  name: string,
  prefix: readonly number[],
  opcodes: readonly number[],
  nops: number,
  operands: readonly number[] = [],
): TimingCase[] =>
  opcodes.map((opcode) => ({
    name: `${name} (#${hexBytes([...prefix, opcode])})`,
    code: [...prefix, opcode, ...operands],
    nops,
    registers: POINTERS,
  }));

const CB = [0xcb];

const CB_TIMINGS: readonly TimingCase[] = [
  ...eachPrefixed(
    "rlc rrc rl rr sla sra sl1 srl r",
    CB,
    withBits3To5In(0x00).flatMap((op) => withRegisterIn(op, 0)),
    2 + RET_NOPS,
  ),
  ...eachPrefixed(
    "rlc rrc rl rr sla sra sl1 srl (hl)",
    CB,
    withBits3To5In(0x06),
    4 + RET_NOPS,
  ),
  ...eachPrefixed(
    "bit b,r",
    CB,
    withBits3To5In(0x40).flatMap((op) => withRegisterIn(op, 0)),
    2 + RET_NOPS,
  ),
  ...eachPrefixed("bit b,(hl)", CB, withBits3To5In(0x46), 3 + RET_NOPS),
  ...eachPrefixed(
    "res b,r / set b,r",
    CB,
    [...withBits3To5In(0x80), ...withBits3To5In(0xc0)].flatMap((op) =>
      withRegisterIn(op, 0),
    ),
    2 + RET_NOPS,
  ),
  ...eachPrefixed(
    "res b,(hl) / set b,(hl)",
    CB,
    [...withBits3To5In(0x86), ...withBits3To5In(0xc6)],
    4 + RET_NOPS,
  ),
];

describe("the NOPs of a CB instruction", () => {
  it("covers every opcode of the CB table", () => {
    const opcodes = new Set(CB_TIMINGS.map(({ code }) => code[1]));

    expect(opcodes.size).toBe(256);
  });

  it.each(CB_TIMINGS)("runs $name in $nops NOPs, RET included", runsInItsNops);
});

const ED = [0xed];
const BLOCK_SLOTS = [0xa0, 0xa8, 0xb0, 0xb8].flatMap((row) =>
  [0, 1, 2, 3].map((column) => row | column),
);
// Madram gives no value for these: like any ED opcode the core runs as a `NOP`, they are two
// opcode fetches of 4 T-states, so 2 NOPs by the rule of his "Timing" section.
const UNDEFINED_ED = Array.from({ length: 256 }, (_, op) => op).filter(
  (op) =>
    op < 0x40 ||
    op >= 0xc0 ||
    op === 0x77 ||
    op === 0x7f ||
    (op >= 0x80 && !BLOCK_SLOTS.includes(op)),
);

const ED_TIMINGS: readonly TimingCase[] = [
  ...eachPrefixed(
    "in r,(c) / in 0,(c)",
    ED,
    withBits3To5In(0x40),
    4 + RET_NOPS,
  ),
  ...eachPrefixed(
    "out (c),r / out (c),0",
    ED,
    withBits3To5In(0x41),
    4 + RET_NOPS,
  ),
  ...eachPrefixed("sbc hl,rr", ED, withPairIn(0x42), 4 + RET_NOPS),
  ...eachPrefixed("adc hl,rr", ED, withPairIn(0x4a), 4 + RET_NOPS),
  ...eachPrefixed(
    "ld (nn),rr",
    ED,
    withPairIn(0x43),
    6 + RET_NOPS,
    [0x00, 0x60],
  ),
  ...eachPrefixed(
    "ld rr,(nn)",
    ED,
    [0x4b, 0x5b, 0x6b],
    6 + RET_NOPS,
    [0x00, 0x60],
  ),
  {
    name: "ld (nn),sp, ld sp,(nn) (#ED73, #ED7B)",
    code: [0xed, 0x73, 0x00, 0x60, 0xed, 0x7b, 0x00, 0x60],
    nops: 6 + 6 + RET_NOPS,
  },
  // The undocumented copies of neg, retn and im take the time of the documented one.
  ...eachPrefixed("neg", ED, withBits3To5In(0x44), 2 + RET_NOPS),
  ...eachPrefixed(
    "retn / reti, returning to the caller",
    ED,
    withBits3To5In(0x45),
    4,
  ),
  ...eachPrefixed("im 0 / im 1 / im 2", ED, withBits3To5In(0x46), 2 + RET_NOPS),
  ...eachPrefixed(
    "ld i,a / ld r,a / ld a,i / ld a,r",
    ED,
    [0x47, 0x4f, 0x57, 0x5f],
    3 + RET_NOPS,
  ),
  ...eachPrefixed("rrd / rld", ED, [0x67, 0x6f], 5 + RET_NOPS),
  ...eachPrefixed("ldi / ldd", ED, [0xa0, 0xa8], 5 + RET_NOPS),
  ...eachPrefixed("cpi / cpd", ED, [0xa1, 0xa9], 4 + RET_NOPS),
  ...eachPrefixed(
    "ini / ind / outi / outd",
    ED,
    [0xa2, 0xaa, 0xa3, 0xab],
    5 + RET_NOPS,
  ),
  ...eachPrefixed("undefined, run as NOP", ED, UNDEFINED_ED, 2 + RET_NOPS),
];

describe("the NOPs of an ED instruction", () => {
  it("covers every opcode of the ED table, the repeated ones apart", () => {
    const opcodes = new Set(
      ED_TIMINGS.flatMap(({ code }) =>
        code.filter((_, i) => code[i - 1] === 0xed),
      ),
    );

    expect(opcodes.size).toBe(256 - 8);
  });

  it.each(ED_TIMINGS)("runs $name in $nops NOPs, RET included", runsInItsNops);
});

// Madram gives these as free text: "6 / 5 for last iteration", "6 / 4 for last iteration".
// RAM at HL is zero.
const repeated = (
  name: string,
  opcode: number,
  registers: StartRegisters,
  nops: number,
): TimingCase => ({
  name: `${name} (#${hexBytes([0xed, opcode])})`,
  code: [0xed, opcode],
  nops: nops + RET_NOPS,
  registers: { ...POINTERS, ...registers },
});

const REPEATED_TIMINGS: readonly TimingCase[] = [
  ...(
    [
      ["ldir", 0xb0],
      ["lddr", 0xb8],
    ] as const
  ).flatMap(([name, opcode]) => [
    repeated(`${name}, BC 3`, opcode, { bc: 3 }, 6 + 6 + 5),
    repeated(`${name}, BC 1`, opcode, { bc: 1 }, 5),
  ]),
  ...(
    [
      ["cpir", 0xb1],
      ["cpdr", 0xb9],
    ] as const
  ).flatMap(([name, opcode]) => [
    repeated(`${name}, BC 3, no match`, opcode, { bc: 3, a: 1 }, 6 + 6 + 4),
    repeated(`${name}, BC 3, match first`, opcode, { bc: 3, a: 0 }, 4),
    repeated(`${name}, BC 1, no match`, opcode, { bc: 1, a: 1 }, 4),
  ]),
  ...(
    [
      ["inir", 0xb2],
      ["indr", 0xba],
      ["otir", 0xb3],
      ["otdr", 0xbb],
    ] as const
  ).flatMap(([name, opcode]) => [
    repeated(`${name}, B 3`, opcode, { b: 3 }, 6 + 6 + 5),
    repeated(`${name}, B 1`, opcode, { b: 1 }, 5),
  ]),
];

describe("the NOPs of a repeated block instruction", () => {
  it.each(REPEATED_TIMINGS)(
    "runs $name in $nops NOPs, RET included",
    runsInItsNops,
  );
});

// Behind DD or FD, (hl) becomes (ix+n), and jp (hl), ld sp,hl and ex (sp),hl use IX: these
// opcodes get cases of their own.
const CHANGED_BY_INDEX = new Set([
  0x34,
  0x35,
  0x36,
  ...withRegisterIn(0x46, 3),
  ...withRegisterIn(0x70, 0),
  ...withBits3To5In(0x86),
  0xe9,
  0xf9,
  0xe3,
]);

const INDEX_PREFIXES = [
  ["ix", 0xdd],
  ["iy", 0xfd],
] as const;

// Madram: "DD or FD prefix without indirection (inc ixl) adds 4 t-states (1 NOP)".
const INDEXED_TIMINGS: readonly TimingCase[] = INDEX_PREFIXES.flatMap(
  ([index, prefix]) =>
    [...FIXED_TIMINGS, ...CONDITIONAL_TIMINGS]
      .filter(({ code }) => !CHANGED_BY_INDEX.has(code[0] ?? 0))
      .map((timing) => ({
        ...timing,
        name: `${index} prefix on ${timing.name}`,
        code: [prefix, ...timing.code],
        nops: timing.nops + 1,
      })),
);

const INDEX_REGISTER_TIMINGS: readonly TimingCase[] = INDEX_PREFIXES.flatMap(
  ([index, prefix]) => [
    // Madram's own rows, apart from the rule above.
    {
      name: `ld ${index},nn`,
      code: [prefix, 0x21, 0x00, 0x50],
      nops: 4 + RET_NOPS,
    },
    {
      name: `ld ${index},(nn), ld (nn),${index}`,
      code: [prefix, 0x2a, 0x00, 0x60, prefix, 0x22, 0x00, 0x60],
      nops: 6 + 6 + RET_NOPS,
    },
    {
      name: `push ${index}, pop ${index}`,
      code: [prefix, 0xe5, prefix, 0xe1],
      nops: 5 + 4 + RET_NOPS,
    },
    ...withPairIn(0x09).map((opcode) => ({
      name: `add ${index},rr (#${hexBytes([prefix, opcode])})`,
      code: [prefix, opcode],
      nops: 4 + RET_NOPS,
    })),
    {
      name: `inc ${index}, dec ${index}`,
      code: [prefix, 0x23, prefix, 0x2b],
      nops: 3 + 3 + RET_NOPS,
    },
    {
      name: `jp (${index})`,
      code: [prefix, 0xe9],
      nops: 2 + RET_NOPS,
      registers: { [index]: 0x5000 },
    },
    {
      name: `ld sp,${index}`,
      code: [prefix, 0xf9],
      nops: 3 + RET_NOPS,
      registers: { [index]: 0xbffe },
    },
    {
      name: `ex (sp),${index}, ex (sp),${index}`,
      code: [prefix, 0xe3, prefix, 0xe3],
      nops: 7 + 7 + RET_NOPS,
    },
  ],
);

const DISPLACEMENT = 0x05;

const INDIRECT_TIMINGS: readonly TimingCase[] = INDEX_PREFIXES.flatMap(
  ([index, prefix]) => {
    const indirect = (
      name: string,
      opcodes: readonly number[],
      nops: number,
      operands: readonly number[] = [],
    ): TimingCase[] =>
      opcodes.map((opcode) => ({
        name: `${name.replaceAll("ix", index)} (#${hexBytes([prefix, opcode])})`,
        code: [prefix, opcode, DISPLACEMENT, ...operands],
        nops: nops + RET_NOPS,
        registers: { [index]: 0x6000 },
      }));
    return [
      ...indirect("ld r,(ix+n)", withRegisterIn(0x46, 3), 5),
      ...indirect("ld (ix+n),r", withRegisterIn(0x70, 0), 5),
      ...indirect("alu (ix+n)", withBits3To5In(0x86), 5),
      ...indirect("inc (ix+n) / dec (ix+n)", [0x34, 0x35], 6),
      // Missing from Madram's tables. By his rule, from the machine cycles of the Z80 user
      // manual (UM0080), 4 4 3 5 3 T-states: 1 + 1 + 1 + 2 + 1 = 6 NOPs.
      ...indirect("ld (ix+n),n", [0x36], 6, [0x12]),
    ];
  },
);

// The displacement comes before the opcode. Madram lists the undocumented `rlc (ix+n),r`,
// `res b,(ix+n),r` and `set b,(ix+n),r` at 7 NOPs; the core runs an undocumented `bit` as
// `bit b,(ix+n)`.
const INDEXED_CB_TIMINGS: readonly TimingCase[] = INDEX_PREFIXES.flatMap(
  ([index, prefix]) => {
    const indexedCb = (
      name: string,
      opcodes: readonly number[],
      nops: number,
    ): TimingCase[] =>
      opcodes.map((opcode) => ({
        name: `${name.replaceAll("ix", index)} (#${hexBytes([prefix, 0xcb, DISPLACEMENT, opcode])})`,
        code: [prefix, 0xcb, DISPLACEMENT, opcode],
        nops: nops + RET_NOPS,
        registers: { [index]: 0x6000 },
      }));
    const everyOperand = (bases: readonly number[]) =>
      bases.flatMap((base) => [0, 1, 2, 3, 4, 5, 6, 7].map((r) => base | r));
    return [
      ...indexedCb("bit b,(ix+n)", everyOperand(withBits3To5In(0x40)), 6),
      ...indexedCb(
        "rlc … srl (ix+n), and with r",
        everyOperand(withBits3To5In(0x00)),
        7,
      ),
      ...indexedCb(
        "res b,(ix+n) / set b,(ix+n), and with r",
        everyOperand([...withBits3To5In(0x80), ...withBits3To5In(0xc0)]),
        7,
      ),
    ];
  },
);

describe("the NOPs of a DDCB or FDCB instruction", () => {
  it("covers every opcode of the DDCB and FDCB tables", () => {
    const opcodes = new Set(
      INDEXED_CB_TIMINGS.map(({ code }) =>
        hexBytes([code[0] ?? 0, code[3] ?? 0]),
      ),
    );

    expect(opcodes.size).toBe(2 * 256);
  });

  it.each(INDEXED_CB_TIMINGS)(
    "runs $name in $nops NOPs, RET included",
    runsInItsNops,
  );
});

// cell80 runs a chain of prefixes as one instruction. A DD or FD that another prefix follows
// does nothing but its opcode fetch, 4 T-states: 1 NOP more, as Madram's rule gives.
const PREFIX_CHAIN_TIMINGS: readonly TimingCase[] = [
  {
    name: "ld ix,nn behind another DD (#DDDD21)",
    code: [0xdd, 0xdd, 0x21, 0x00, 0x50],
    nops: 1 + 4 + RET_NOPS,
  },
  {
    name: "ld ix,nn behind an FD (#FDDD21)",
    code: [0xfd, 0xdd, 0x21, 0x00, 0x50],
    nops: 1 + 4 + RET_NOPS,
  },
  {
    name: "neg behind a DD (#DDED44)",
    code: [0xdd, 0xed, 0x44],
    nops: 1 + 2 + RET_NOPS,
  },
  {
    // Repeating moves PC back 2 bytes, to ED: only the first iteration pays for the FD.
    name: "ldir behind an FD, BC 3 (#FDEDB0)",
    code: [0xfd, 0xed, 0xb0],
    nops: 1 + 6 + 6 + 5 + RET_NOPS,
    registers: { ...POINTERS, bc: 3 },
  },
  {
    name: "set 0,(iy+n) behind a DD (#DDFDCB05C6)",
    code: [0xdd, 0xfd, 0xcb, DISPLACEMENT, 0xc6],
    nops: 1 + 7 + RET_NOPS,
    registers: { iy: 0x6000 },
  },
];

describe("the NOPs of an instruction behind an IX or IY prefix", () => {
  it.each([
    ...INDEXED_TIMINGS,
    ...INDEX_REGISTER_TIMINGS,
    ...INDIRECT_TIMINGS,
    ...PREFIX_CHAIN_TIMINGS,
  ])("runs $name in $nops NOPs, RET included", runsInItsNops);
});

const JR_N = 0x18;
const INC_A = 0x3c;
const HALT = 0x76;

describe("a Run exceeding its NOP limit", () => {
  it("fails at the default limit of 1,000,000 NOPs, saying so", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [JR_N, 0xfe] }],
      symbols: { forever: 0x4000 },
    });

    expect(() => program.run("forever")).toThrow(/NOP limit of 1,000,000 NOPs/);
  });

  it("fails at the limit the test sets, and passes when it lasts exactly that", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [NOP, LD_A_N, 5, RET] }],
      symbols: { set_a: 0x4000 },
    });

    expect(program.run("set_a", { nopLimit: 6 }).nops).toBe(6);
    expect(() => program.run("set_a", { nopLimit: 5 })).toThrow(
      /NOP limit of 5 NOPs/,
    );
  });

  it("refuses a limit that is not a whole number of NOPs, which would never stop it", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    for (const nopLimit of [Number.NaN, -1, 2.5]) {
      expect(() => program.run("nothing", { nopLimit })).toThrow(/NOP limit/);
    }
  });
});

describe("a Run stuck on HALT", () => {
  // Each step on HALT, then halted, is one M1 cycle: R goes up by one per NOP.
  it("counts the HALT, then 1 NOP per step halted, until the limit", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [HALT] }],
      symbols: { wait: 0x4000 },
    });

    const failure = () => program.run("wait", { nopLimit: 100 });

    expect(failure).toThrow(/NOP limit of 100 NOPs/);
    expect(failure).toThrow(/R #64/);
    expect(failure).toThrow(/#4000 +wait +HALT\n\n/);
  });

  // An IX prefix adds 1 NOP and one M1 cycle: R reaches #64 after 100 NOPs all the same.
  it("counts a HALT behind an IX prefix as 2 NOPs", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [0xdd, HALT] }],
      symbols: { wait: 0x4000 },
    });

    expect(() => program.run("wait", { nopLimit: 100 })).toThrow(/R #64/);
  });

  // A million steps, the slowest a Run can take to reach the default limit.
  it("fails at the default limit in well under a second", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [HALT] }],
      symbols: { wait: 0x4000 },
    });

    const start = performance.now();
    expect(() => program.run("wait")).toThrow(/NOP limit/);

    expect(performance.now() - start).toBeLessThan(1000);
  });
});

describe("the failure report of a Run", () => {
  it("shows each instruction executed, disassembled, with its address and the nearest label at or below it", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_N, 5, INC_A, JR_N, 0xfd] }],
      symbols: { start: 0x4000, loop: 0x4002, data: 0x6000 },
    });

    const failure = () => program.run("start", { nopLimit: 10 });

    expect(failure).toThrow(/#4000 +start +LD A,#05\n/);
    expect(failure).toThrow(/#4002 +loop +INC A\n/);
    expect(failure).toThrow(/#4003 +loop\+1 +JR #4002\n/);
  });

  it("shows the first label of the symbol table when several share an address, and none below the lowest", async () => {
    const program = await load({
      blocks: [
        { address: 0x3000, bytes: [JP_NN, 0x00, 0x40] },
        { address: 0x4000, bytes: [JR_N, 0xfe] },
      ],
      symbols: { main: 0x4000, alias: 0x4000, entry: 0x3000 },
    });

    const failure = () => program.run("entry", { nopLimit: 6 });

    expect(failure).toThrow(/#3000 +entry +JP #4000\n/);
    expect(failure).toThrow(/#4000 +main +JR #4000\n/);
  });

  it("shows no label for an instruction below every label", async () => {
    const program = await load({
      blocks: [
        { address: 0x3000, bytes: [JR_N, 0xfe] },
        { address: 0x4000, bytes: [JP_NN, 0x00, 0x30] },
      ],
      symbols: { jump_down: 0x4000 },
    });

    const failure = () => program.run("jump_down", { nopLimit: 6 });

    expect(failure).toThrow(/^ {2}#3000 +JR #3000$/m);
  });

  it("shows only the last 16 instructions executed", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: new Array(25).fill(NOP) }],
      symbols: { nops: 0x4000 },
    });

    const failure = () => program.run("nops", { nopLimit: 20 });

    expect(failure).toThrow(/^ +#4004 /m);
    expect(failure).toThrow(/^ +#4013 /m);
    expect(failure).not.toThrow(/^ +#4003 /m);
    expect(failure).not.toThrow(/^ +#4014 /m);
  });

  it("shows the final registers", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [JR_N, 0xfe] }],
      symbols: { forever: 0x4000 },
    });

    const failure = () =>
      program.run("forever", {
        nopLimit: 30,
        registers: { a: 0x5a, bc: 0x1234, hlPrime: 0xabcd, iy: 0x0042 },
      });

    expect(failure).toThrow(/AF #5A00/);
    expect(failure).toThrow(/BC #1234/);
    expect(failure).toThrow(/HL' #ABCD/);
    expect(failure).toThrow(/IY #0042/);
    expect(failure).toThrow(/SP #BFFE/);
    expect(failure).toThrow(/PC #4000/);
  });
});
