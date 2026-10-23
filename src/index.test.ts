import { describe, expect, it } from "vitest";
import { type Assembly, inMemoryAssembler, loadProgram } from "./index.ts";

const LD_A_N = 0x3e;
const RET = 0xc9;
const ADD_A_B = 0x80;
const ADC_A_N = 0xce;
const SUB_A = 0x97;
const EXX = 0xd9;
const ADD_IX_BC = [0xdd, 0x09];
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

    expect(program.label("buffer")).toBe(0x5000);
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
      blocks: [{ address: 0x4000, bytes: [...ADD_IX_BC, EXX, RET] }],
      symbols: { add_and_swap: 0x4000 },
    });

    const run = program.run("add_and_swap", {
      registers: { bc: 0x0102, ix: 0x1000, bcPrime: 0xbeef },
    });

    expect(run.registers.ix).toBe(0x1102);
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
});
