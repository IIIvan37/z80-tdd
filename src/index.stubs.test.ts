import { describe, expect, it } from "vitest";
import {
  type Assembly,
  inMemoryAssembler,
  loadProgram,
  type StubRegisters,
} from "./index.ts";

const LD_A_N = 0x3e;
const LD_B_N = 0x06;
const LD_B_A = 0x47;
const CALL_NN = 0xcd;
const JP_NN = 0xc3;
const RET = 0xc9;

function load(assembly: Assembly) {
  return loadProgram({
    source: "main.asm",
    assembler: inMemoryAssembler({ "main.asm": assembly }),
  });
}

describe("a Stub", () => {
  it("returns to the caller at once, as a RET would, without running the code at its label", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [CALL_NN, 0x10, 0x40, LD_A_N, 0x01, RET] },
        { address: 0x4010, bytes: [LD_B_N, 0x99, RET] },
      ],
      symbols: { game_loop: 0x4000, play_sound: 0x4010 },
    });

    const run = program.run("game_loop", { stubs: [{ at: "play_sound" }] });

    expect(run.registers.a).toBe(0x01);
    expect(run.registers.b).toBe(0x00);
  });

  it("sets the registers the test chose before it returns", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [CALL_NN, 0x10, 0x40, LD_B_A, RET] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { scan_keys: 0x4000, read_keys: 0x4010 },
    });

    const run = program.run("scan_keys", {
      stubs: [{ at: "read_keys", registers: { a: 0xfb, hl: 0x1234 } }],
    });

    expect(run.registers.b).toBe(0xfb);
    expect(run.registers.hl).toBe(0x1234);
  });

  it("sets the flags the test chose after its registers", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [CALL_NN, 0x10, 0x40, RET] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { wait_key: 0x4000, read_key: 0x4010 },
    });

    const run = program.run("wait_key", {
      stubs: [{ at: "read_key", registers: { f: 0x00 }, flags: { c: true } }],
    });

    expect(run.flags.c).toBe(true);
    expect(run.registers.f).toBe(0x01);
  });

  it("records its call with the registers at the moment of the call, before it sets its own", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [LD_A_N, 0x03, CALL_NN, 0x10, 0x40, RET] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { game_loop: 0x4000, play_sound: 0x4010 },
    });

    const run = program.run("game_loop", {
      stubs: [{ at: "play_sound", registers: { a: 0x00 } }],
    });

    expect(run.stubCalls).toMatchObject([
      { at: "play_sound", registers: { a: 0x03, pc: 0x4010 } },
    ]);
  });

  it("costs 3 NOPs by default, the price of a RET, on top of the CALL the Routine paid", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [CALL_NN, 0x10, 0x40, RET] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { game_loop: 0x4000, play_sound: 0x4010 },
    });

    const run = program.run("game_loop", { stubs: [{ at: "play_sound" }] });

    // CALL nn 5, the Stub 3, RET 3
    expect(run.nops).toBe(11);
  });

  it("costs the NOPs the test gives it instead", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [CALL_NN, 0x10, 0x40, RET] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { game_loop: 0x4000, play_sound: 0x4010 },
    });

    const run = program.run("game_loop", {
      stubs: [{ at: "play_sound", nops: 120 }],
    });

    // CALL nn 5, the Stub 120, RET 3
    expect(run.nops).toBe(128);
  });

  it("lets a Routine call the firmware at an address, whose ROM is not loaded", async () => {
    const program = await load({
      // ld a,"H" / call #BB5A (TXT OUTPUT) / ret
      blocks: [
        { address: 0x4000, bytes: [LD_A_N, 0x48, CALL_NN, 0x5a, 0xbb, RET] },
      ],
      symbols: { print_h: 0x4000 },
    });

    const run = program.run("print_h", { stubs: [{ at: 0xbb5a }] });

    expect(run.stubCalls).toMatchObject([
      { at: 0xbb5a, registers: { a: 0x48 } },
    ]);
  });

  it("fails the Run when its NOPs pass the NOP limit, even as the Routine's last jump", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [JP_NN, 0x10, 0x40] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { game_loop: 0x4000, play_sound: 0x4010 },
    });

    const failure = () =>
      program.run("game_loop", {
        nopLimit: 50,
        stubs: [{ at: "play_sound", nops: 100 }],
      });

    expect(failure).toThrow(/^The Run reached its NOP limit of 50 NOPs\n/);
    expect(failure).toThrow(/PC #4010/);
  });
});

describe("the Stubs of a Run", () => {
  it("refuses a Stub duration that is not a whole number of NOPs, naming the Stub", async () => {
    const program = await load({
      blocks: [{ address: 0x4010, bytes: [RET] }],
      symbols: { play_sound: 0x4010 },
    });

    for (const nops of [-1, 2.5]) {
      expect(() =>
        program.run("play_sound", { stubs: [{ at: "play_sound", nops }] }),
      ).toThrow(
        `The Stub at play_sound cannot cost ${nops} NOPs: it takes a whole number of NOPs, 0 or more`,
      );
    }
  });

  it("refuses a value too wide for a register the Stub sets, naming the Stub", async () => {
    const program = await load({
      blocks: [{ address: 0x4010, bytes: [RET] }],
      symbols: { play_sound: 0x4010 },
    });

    expect(() =>
      program.run("play_sound", {
        stubs: [{ at: 0xbb5a, registers: { a: 0x100 } }],
      }),
    ).toThrow(
      "Register a of the Stub at #BB5A cannot hold 256: it takes 0 to 255",
    );
  });

  it("refuses SP or PC set by a Stub, which its return sets", async () => {
    const program = await load({
      blocks: [{ address: 0x4010, bytes: [RET] }],
      symbols: { play_sound: 0x4010 },
    });

    for (const name of ["sp", "pc"]) {
      const registers = { [name]: 0x8000 } as StubRegisters;
      expect(() =>
        program.run("play_sound", { stubs: [{ at: "play_sound", registers }] }),
      ).toThrow(
        `Register ${name} of the Stub at play_sound cannot be set: the Stub's return sets SP and PC`,
      );
    }
  });

  it("refuses two Stubs at the same address", async () => {
    const program = await load({
      blocks: [{ address: 0x4010, bytes: [RET] }],
      symbols: { play_sound: 0x4010 },
    });

    expect(() =>
      program.run("play_sound", {
        stubs: [{ at: "play_sound" }, { at: 0x4010, nops: 10 }],
      }),
    ).toThrow("The Stubs at play_sound and #4010 are both at #4010");
  });

  it("refuses a Stub at a label the Program does not have, naming the label", async () => {
    const program = await load({
      blocks: [{ address: 0x4010, bytes: [RET] }],
      symbols: { play_sound: 0x4010 },
    });

    expect(() =>
      program.run("play_sound", { stubs: [{ at: "play_sund" }] }),
    ).toThrow('The Program has no label "play_sund"');
  });

  it("refuses a Stub at a value that is not an address, which PC never reaches", async () => {
    const program = await load({
      blocks: [{ address: 0x4010, bytes: [RET] }],
      symbols: { play_sound: 0x4010 },
    });

    for (const at of [-1, 0x10000, 0.5]) {
      expect(() => program.run("play_sound", { stubs: [{ at }] })).toThrow(
        `A Stub cannot be at ${at}: it takes #0000 to #FFFF`,
      );
    }
  });
});
