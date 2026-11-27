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
const LD_A_FROM_NN = 0x3a;
const LD_NN_FROM_A = 0x32;
const CALL_NN = 0xcd;
const JP_NN = 0xc3;
const HALT = 0x76;
const JR_N = 0x18;
const RET = 0xc9;

function load(assembly: Assembly) {
  return loadProgram({
    source: "main.asm",
    assembler: inMemoryAssembler({ "main.asm": assembly }),
  });
}

// A Routine that returns at once, for the checks made before the first step.
function loadPlaySound() {
  return load({
    blocks: [{ address: 0x4010, bytes: [RET] }],
    symbols: { play_sound: 0x4010 },
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

  it("is not called by a halted CPU, which runs no instruction after the HALT", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [HALT, RET] }],
      symbols: { wait_frame: 0x4000, after_halt: 0x4001 },
    });

    const failure = () =>
      program.run("wait_frame", {
        nopLimit: 100,
        stubs: [{ at: "after_halt" }],
      });

    expect(failure).toThrow(/^The Run reached its NOP limit of 100 NOPs\n/);
  });

  it("shows its call among the last instructions of a failure report", async () => {
    const program = await load({
      // call play_sound / forever: jr forever
      blocks: [
        { address: 0x4000, bytes: [CALL_NN, 0x10, 0x40, JR_N, 0xfe] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { game_loop: 0x4000, play_sound: 0x4010 },
    });

    const failure = () =>
      program.run("game_loop", {
        nopLimit: 20,
        stubs: [{ at: "play_sound" }],
      });

    expect(failure).toThrow(
      /\n {2}#4000 +game_loop +CALL #4010\n {2}#4010 +play_sound +Stub\n {2}#4003 +game_loop\+3 +JR #4003\n/,
    );
  });
});

describe("the Stubs of a Run", () => {
  it("refuses a Stub duration that is not a whole number of NOPs, naming the Stub", async () => {
    const program = await loadPlaySound();

    for (const nops of [-1, 2.5]) {
      expect(() =>
        program.run("play_sound", { stubs: [{ at: "play_sound", nops }] }),
      ).toThrow(
        `The Stub at play_sound cannot cost ${nops} NOPs: it takes a whole number of NOPs, 0 or more`,
      );
    }
  });

  it("refuses a value too wide for a register the Stub sets, naming the Stub", async () => {
    const program = await loadPlaySound();

    expect(() =>
      program.run("play_sound", {
        stubs: [{ at: 0xbb5a, registers: { a: 0x100 } }],
      }),
    ).toThrow(
      "Register A of the Stub at #BB5A cannot be 256: it takes #00 to #FF",
    );
  });

  it("refuses a name that is not a register among the Stub's, naming the Stub", async () => {
    const program = await loadPlaySound();

    expect(() =>
      program.run("play_sound", {
        stubs: [{ at: 0xbb5a, registers: { foo: 1 } as never }],
      }),
    ).toThrow(
      '"foo" is not a register of the Stub at #BB5A: the registers are',
    );
  });

  it("refuses a register the Stub leaves undefined, naming the Stub", async () => {
    const program = await loadPlaySound();

    expect(() =>
      program.run("play_sound", {
        stubs: [{ at: 0xbb5a, registers: { a: undefined } as never }],
      }),
    ).toThrow(
      "Register A of the Stub at #BB5A cannot be undefined: it takes #00 to #FF",
    );
  });

  it("refuses SP or PC set by a Stub, which its return sets", async () => {
    const program = await loadPlaySound();

    for (const name of ["sp", "pc"]) {
      const registers = { [name]: 0x8000 } as StubRegisters;
      expect(() =>
        program.run("play_sound", { stubs: [{ at: "play_sound", registers }] }),
      ).toThrow(
        `Register ${name.toUpperCase()} of the Stub at play_sound cannot be set: the Stub's return sets SP and PC`,
      );
    }
  });

  it("refuses two Stubs at the same address", async () => {
    const program = await loadPlaySound();

    expect(() =>
      program.run("play_sound", {
        stubs: [{ at: "play_sound" }, { at: 0x4010, nops: 10 }],
      }),
    ).toThrow("The Stubs at play_sound and #4010 are both at #4010");
  });

  it("refuses a Stub at a label the Program does not have, naming the label", async () => {
    const program = await loadPlaySound();

    expect(() =>
      program.run("play_sound", { stubs: [{ at: "play_sund" }] }),
    ).toThrow('The Program has no label "play_sund"');
  });

  it("refuses a Stub at a value that is not an address, which PC never reaches", async () => {
    const program = await loadPlaySound();

    for (const at of [-1, 0x10000, 0.5]) {
      expect(() => program.run("play_sound", { stubs: [{ at }] })).toThrow(
        `A Stub cannot be at ${at}: it takes #0000 to #FFFF`,
      );
    }
  });
});

describe("a Stub's effect", () => {
  it("writes memory the Routine then reads, as the code at its label would have", async () => {
    const program = await load({
      // call read_sector / ld a,(#5000) / ret
      blocks: [
        {
          address: 0x4000,
          bytes: [CALL_NN, 0x10, 0x40, LD_A_FROM_NN, 0x00, 0x50, RET],
        },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { load_level: 0x4000, read_sector: 0x4010, sector: 0x5000 },
    });

    const run = program.run("load_level", {
      stubs: [
        {
          at: "read_sector",
          effect: (_call, memory) => memory.write("sector", [0x42, 0x43]),
        },
      ],
    });

    expect(run.registers.a).toBe(0x42);
    expect(run.memory(0x5001)).toEqual([0x43]);
  });

  it("reads the memory and the registers as they are at the moment of the call", async () => {
    const program = await load({
      // ld a,7 / ld (#5000),a / call select_bank / ret
      blocks: [
        {
          address: 0x4000,
          bytes: [
            LD_A_N,
            0x07,
            LD_NN_FROM_A,
            0x00,
            0x50,
            CALL_NN,
            0x10,
            0x40,
            RET,
          ],
        },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { show_bank: 0x4000, select_bank: 0x4010, window: 0x5000 },
    });
    const seen: unknown[] = [];

    program.run("show_bank", {
      memory: [{ at: 0x5001, bytes: [0x99] }],
      stubs: [
        {
          at: "select_bank",
          registers: { a: 0x00 },
          effect: (call, memory) =>
            seen.push(
              call.at,
              call.registers.a,
              memory.read("window", 2),
              memory.read(0x5001),
            ),
        },
      ],
    });

    expect(seen).toEqual(["select_bank", 0x07, [0x07, 0x99], [0x99]]);
  });

  it("counts the bytes it changes among the Memory changes", async () => {
    const program = await loadPlaySound();

    const run = program.run("play_sound", {
      stubs: [
        {
          at: "play_sound",
          effect: (_call, memory) => memory.write(0x5000, [0x01, 0x00]),
        },
      ],
    });

    expect(run.memoryChanges).toEqual([
      { address: 0x5000, before: 0x00, after: 0x01 },
    ]);
  });

  it("reads and writes past #FFFF on at #0000", async () => {
    const program = await loadPlaySound();
    let read: readonly number[] = [];

    const run = program.run("play_sound", {
      stubs: [
        {
          at: "play_sound",
          effect: (_call, memory) => {
            memory.write(0xffff, [0x01, 0x02]);
            read = memory.read(0xffff, 2);
          },
        },
      ],
    });

    expect(read).toEqual([0x01, 0x02]);
    expect(run.memory(0x0000)).toEqual([0x02]);
  });

  it("shows each RAM bank the Routine selects in a window of 16 KB, and reports the window's changes from the first bank to the last", async () => {
    const program = await load({
      // ld a,#C4 / call select_bank / ld a,#11 / ld (#4000),a
      // ld a,#C5 / call select_bank / ld a,#22 / ld (#7FFF),a
      // ld a,#C4 / call select_bank / ld a,(#4000) / ld b,a
      // ld a,#C5 / call select_bank / ld a,(#7FFF) / ret
      blocks: [
        {
          address: 0x8000,
          bytes: [
            ...[LD_A_N, 0xc4, CALL_NN, 0x40, 0x80],
            ...[LD_A_N, 0x11, LD_NN_FROM_A, 0x00, 0x40],
            ...[LD_A_N, 0xc5, CALL_NN, 0x40, 0x80],
            ...[LD_A_N, 0x22, LD_NN_FROM_A, 0xff, 0x7f],
            ...[LD_A_N, 0xc4, CALL_NN, 0x40, 0x80],
            ...[LD_A_FROM_NN, 0x00, 0x40, LD_B_A],
            ...[LD_A_N, 0xc5, CALL_NN, 0x40, 0x80],
            ...[LD_A_FROM_NN, 0xff, 0x7f, RET],
          ],
        },
        { address: 0x8040, bytes: [RET] },
      ],
      symbols: { fill_banks: 0x8000, select_bank: 0x8040, window: 0x4000 },
    });
    const WINDOW_LENGTH = 0x4000;
    const banks = new Map<number, readonly number[]>();
    let shown = 0xc0;

    const run = program.run("fill_banks", {
      stubs: [
        {
          at: "select_bank",
          effect: ({ registers }, memory) => {
            banks.set(shown, memory.read("window", WINDOW_LENGTH));
            shown = registers.a;
            memory.write(
              "window",
              banks.get(shown) ?? new Array<number>(WINDOW_LENGTH).fill(0),
            );
          },
        },
      ],
    });

    expect(run.registers.b).toBe(0x11);
    expect(run.registers.a).toBe(0x22);
    expect(run.stubCalls).toHaveLength(4);
    // Bank #C4 is no longer in the window, so its byte at #4000 is no Memory change.
    expect(run.memoryChanges).toEqual([
      { address: 0x7fff, before: 0x00, after: 0x22 },
    ]);
  });

  it("returns to the caller whatever it writes on the stack", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [CALL_NN, 0x10, 0x40, LD_A_N, 0x01, RET] },
        { address: 0x4010, bytes: [RET] },
      ],
      symbols: { game_loop: 0x4000, play_sound: 0x4010 },
    });

    const run = program.run("game_loop", {
      stubs: [
        {
          at: "play_sound",
          effect: ({ registers }, memory) =>
            memory.write(registers.sp, [0x00, 0x00]),
        },
      ],
    });

    expect(run.registers.a).toBe(0x01);
  });

  it("fails the Run on a write over the return address of the Routine", async () => {
    const program = await loadPlaySound();

    expect(() =>
      program.run("play_sound", {
        registers: { sp: 0xc000 },
        stubs: [
          {
            at: "play_sound",
            effect: (_call, memory) => memory.write(0xbffd, [0x00, 0x00]),
          },
        ],
      }),
    ).toThrow(
      "The effect of the Stub at play_sound failed: The bytes written at #BFFD would overwrite the return address pushed at #BFFE; set another SP",
    );
  });

  it("fails the Run on a value that is not a byte, naming the Stub and the address", async () => {
    const program = await loadPlaySound();

    for (const byte of [-1, 0x100, 0.5]) {
      expect(() =>
        program.run("play_sound", {
          stubs: [
            {
              at: "play_sound",
              effect: (_call, memory) => memory.write(0x5000, [0x00, byte]),
            },
          ],
        }),
      ).toThrow(
        `The effect of the Stub at play_sound failed: The byte at #5001 cannot be ${byte}: it takes 0 to 255`,
      );
    }
  });

  it("fails the Run with its failure report when the effect throws, and keeps the cause", async () => {
    const program = await loadPlaySound();
    const cause = new Error("no such sector");

    const failed = () =>
      program.run("play_sound", {
        stubs: [
          {
            at: "play_sound",
            effect: () => {
              throw cause;
            },
          },
        ],
      });

    expect(failed).toThrow(
      "The effect of the Stub at play_sound failed: no such sector\n\nLast 1 instructions executed:\n  #4010  play_sound  Stub",
    );
    expect(failed).toThrow(expect.objectContaining({ cause }));
  });

  it("fails the Run on a label the Program does not have, naming the Stub", async () => {
    const program = await loadPlaySound();

    expect(() =>
      program.run("play_sound", {
        stubs: [
          {
            at: "play_sound",
            effect: (_call, memory) => memory.read("no_such_label"),
          },
        ],
      }),
    ).toThrow(/^The effect of the Stub at play_sound failed: .*no_such_label/);
  });
});
