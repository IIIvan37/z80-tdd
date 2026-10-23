import { describe, expect, it } from "vitest";
import {
  type Assembly,
  inMemoryAssembler,
  loadProgram,
  memoryMatchers,
} from "./index.ts";

expect.extend(memoryMatchers);

const RET = 0xc9;
const LD_A_N = 0x3e;
const LD_A_FROM_NN = 0x3a;
const LD_NN_FROM_A = 0x32;
const PUSH_BC = 0xc5;
const POP_BC = 0xc1;
const CALL_NN = 0xcd;
const LD_SP_NN = 0x31;

function load(assembly: Assembly) {
  return loadProgram({
    source: "main.asm",
    assembler: inMemoryAssembler({ "main.asm": assembly }),
  });
}

describe("a range of the Program", () => {
  it("starts at a label and spans the given length", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000, buffer: 0x5000 },
    });

    expect(program.range("buffer", 16)).toEqual({
      address: 0x5000,
      length: 16,
    });
  });

  it("fails on a length that is not 1 to 65,536 bytes", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000, buffer: 0x5000 },
    });

    expect(() => program.range("buffer", 0)).toThrow(
      "A range cannot be 0 bytes long: it takes 1 to 65,536",
    );
  });
});

describe("memory before a Run", () => {
  it("holds the bytes the test writes at a label", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_FROM_NN, 0x00, 0x50, RET] }],
      symbols: { read: 0x4000, buffer: 0x5000 },
    });

    const run = program.run("read", {
      memory: [{ at: "buffer", bytes: [0x2a, 0x2b] }],
    });

    expect(run.registers.a).toBe(0x2a);
  });

  it("wraps the bytes written past #FFFF to #0000", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_FROM_NN, 0x00, 0x00, RET] }],
      symbols: { read: 0x4000 },
    });

    const run = program.run("read", {
      memory: [{ at: 0xffff, bytes: [0x2a, 0x2b] }],
    });

    expect(run.registers.a).toBe(0x2b);
  });

  it("fails on a value that is not a byte, naming its address", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000, buffer: 0x5000 },
    });

    expect(() =>
      program.run("nothing", { memory: [{ at: "buffer", bytes: [1, 256] }] }),
    ).toThrow("The byte at #5001 cannot be 256: it takes 0 to 255");
  });

  it("fails when the bytes would overwrite the return address the tool pushed", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [RET] }],
      symbols: { nothing: 0x4000 },
    });

    expect(() =>
      program.run("nothing", { memory: [{ at: 0xbffd, bytes: [1, 2] }] }),
    ).toThrow(
      "The bytes written at #BFFD would overwrite the return address pushed at #BFFE; set another SP",
    );
  });
});

describe("memory after a Run", () => {
  it("reads the bytes the Routine wrote, at a label or an address", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [LD_A_N, 0x55, LD_NN_FROM_A, 0x01, 0x50, RET],
        },
      ],
      symbols: { write: 0x4000, buffer: 0x5000 },
    });

    const run = program.run("write", {
      memory: [{ at: 0x5000, bytes: [0x11, 0x22, 0x33] }],
    });

    expect(run.memory("buffer", 3)).toEqual([0x11, 0x55, 0x33]);
    expect(run.memory(0x5001)).toEqual([0x55]);
  });
});

describe("the Memory changes of a Run", () => {
  it("list each byte the Routine changed, but not a byte it rewrote with its value", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [
            ...[LD_A_N, 0x55, LD_NN_FROM_A, 0x01, 0x50],
            ...[LD_A_N, 0x33, LD_NN_FROM_A, 0x02, 0x50],
            RET,
          ],
        },
      ],
      symbols: { write: 0x4000, buffer: 0x5000 },
    });

    const run = program.run("write", {
      memory: [{ at: "buffer", bytes: [0x11, 0x22, 0x33] }],
    });

    expect(run.memoryChanges).toEqual([
      { address: 0x5001, before: 0x22, after: 0x55 },
    ]);
  });

  it("leave out the stack the Routine used", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [PUSH_BC, POP_BC, CALL_NN, 0x10, 0x40, RET] },
        { address: 0x4010, bytes: [PUSH_BC, POP_BC, RET] },
      ],
      symbols: { nested: 0x4000 },
    });

    const run = program.run("nested", { registers: { bc: 0x1234 } });

    expect(run.memoryChanges).toEqual([]);
  });

  it("keep the bytes a Routine pushes after moving SP to a buffer", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          // #BFFE: the default SP, #C000, below the return address the tool pushed.
          bytes: [LD_SP_NN, 0x04, 0x50, PUSH_BC, LD_SP_NN, 0xfe, 0xbf, RET],
        },
      ],
      symbols: { fill: 0x4000 },
    });

    const run = program.run("fill", { registers: { bc: 0x1234 } });

    expect(run.memoryChanges).toEqual([
      { address: 0x5002, before: 0x00, after: 0x34 },
      { address: 0x5003, before: 0x00, after: 0x12 },
    ]);
  });

  it("keep the bytes pushed after SP jumps just below the stack it shrank back from", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [
            ...[PUSH_BC, PUSH_BC, POP_BC, POP_BC],
            ...[LD_SP_NN, 0xf8, 0xbf, PUSH_BC],
            ...[LD_SP_NN, 0xfe, 0xbf, RET],
          ],
        },
      ],
      symbols: { jump: 0x4000 },
    });

    const run = program.run("jump", { registers: { bc: 0x1234 } });

    expect(run.memoryChanges).toEqual([
      { address: 0xbff6, before: 0x00, after: 0x34 },
      { address: 0xbff7, before: 0x00, after: 0x12 },
    ]);
  });

  it("give a frozen list, and memory reads give frozen bytes", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [LD_A_N, 0x11, LD_NN_FROM_A, 0x00, 0x50, RET],
        },
      ],
      symbols: { write: 0x4000, buffer: 0x5000 },
    });

    const run = program.run("write");

    expect(Object.isFrozen(run.memoryChanges)).toBe(true);
    expect(Object.isFrozen(run.memoryChanges[0])).toBe(true);
    expect(Object.isFrozen(run.memory("buffer", 2))).toBe(true);
  });
});

describe("the matcher toChangeOnly", () => {
  it("fails on a write one byte past the range, printing that change", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [
            ...[LD_A_N, 0x11, LD_NN_FROM_A, 0x00, 0x50],
            ...[LD_A_N, 0xaa, LD_NN_FROM_A, 0x10, 0x50],
            RET,
          ],
        },
      ],
      symbols: { overflow: 0x4000, buffer: 0x5000 },
    });

    const run = program.run("overflow");

    expect(() => expect(run).toChangeOnly(program.range("buffer", 16))).toThrow(
      "Memory changed outside #5000-#500F:\n  #5010  #00 -> #AA",
    );
  });

  it("passes when the Routine writes only inside the range", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [
            ...[LD_A_N, 0x11, LD_NN_FROM_A, 0x00, 0x50],
            ...[LD_A_N, 0x22, LD_NN_FROM_A, 0x0f, 0x50],
            RET,
          ],
        },
      ],
      symbols: { fill: 0x4000, buffer: 0x5000 },
    });

    const run = program.run("fill");

    expect(run).toChangeOnly(program.range("buffer", 16));
    expect(() =>
      expect(run).not.toChangeOnly(program.range("buffer", 16)),
    ).toThrow("Memory changed only inside #5000-#500F");
  });
});

describe("the matcher toLeaveMemoryUnchanged", () => {
  it("passes for a Routine that only reads memory and calls another", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [LD_A_FROM_NN, 0x00, 0x50, CALL_NN, 0x10, 0x40, RET],
        },
        { address: 0x4010, bytes: [PUSH_BC, POP_BC, RET] },
      ],
      symbols: { read: 0x4000, buffer: 0x5000 },
    });

    const run = program.run("read");

    expect(run).toLeaveMemoryUnchanged();
    expect(() => expect(run).not.toLeaveMemoryUnchanged()).toThrow(
      "Memory did not change",
    );
  });

  it("fails on any Memory change, printing it", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [LD_A_N, 0x11, LD_NN_FROM_A, 0x00, 0x50, RET],
        },
      ],
      symbols: { write: 0x4000 },
    });

    const run = program.run("write");

    expect(() => expect(run).toLeaveMemoryUnchanged()).toThrow(
      "Memory changed:\n  #5000  #00 -> #11",
    );
  });
});

describe("the matcher toChangeOnly on a range past #FFFF", () => {
  it("wraps the range to #0000 and names its real end", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [
            ...[LD_A_N, 0x11, LD_NN_FROM_A, 0x00, 0x00],
            ...[LD_NN_FROM_A, 0x02, 0x00],
            RET,
          ],
        },
      ],
      symbols: { write: 0x4000, top: 0xfffe },
    });

    const run = program.run("write");

    expect(() => expect(run).toChangeOnly(program.range("top", 3))).toThrow(
      "Memory changed outside #FFFE-#0000:\n  #0002  #00 -> #11",
    );
  });
});
