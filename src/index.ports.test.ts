import { describe, expect, it } from "vitest";
import { type Assembly, inMemoryAssembler, loadProgram } from "./index.ts";

const NOP = 0x00;
const LD_A_N = 0x3e;
const LD_B_N = 0x06;
const RRA = 0x1f;
const JR_NC_N = 0x30;
const LD_BC_NN = 0x01;
const LD_HL_NN = 0x21;
const OUT_N_A = 0xd3;
const ED = 0xed;
const OUT_C_C = 0x49;
const OUT_C_A = 0x79;
const OTIR = 0xb3;
const IN_A_C = 0x78;
const INIR = 0xb2;
const RET = 0xc9;

// ld b,#f5 / wait: in a,(c) / rra / jr nc,wait / ret
const WAIT_VSYNC = [LD_B_N, 0xf5, ED, IN_A_C, RRA, JR_NC_N, 0xfb, RET];

function load(assembly: Assembly) {
  return loadProgram({
    source: "main.asm",
    assembler: inMemoryAssembler({ "main.asm": assembly }),
  });
}

// A Routine that returns at once, for the checks made before the first step.
function loadNothing() {
  return load({
    blocks: [{ address: 0x4000, bytes: [RET] }],
    symbols: { nothing: 0x4000 },
  });
}

describe("the Port writes of a Run", () => {
  it("records OUT (n),A with A as the high byte of the port address", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [LD_A_N, 0x7f, OUT_N_A, 0xc0, RET] }],
      symbols: { select_pen: 0x4000 },
    });

    const run = program.run("select_pen");

    expect(run.portWrites).toEqual([{ address: 0x7fc0, value: 0x7f }]);
  });

  it("records OUT (C),r at BC, in order", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [
            ...[LD_BC_NN, 0x06, 0xbc, ED, OUT_C_C],
            ...[LD_BC_NN, 0x20, 0xbd, ED, OUT_C_C, RET],
          ],
        },
      ],
      symbols: { set_crtc: 0x4000 },
    });

    const run = program.run("set_crtc");

    expect(run.portWrites).toEqual([
      { address: 0xbc06, value: 0x06 },
      { address: 0xbd20, value: 0x20 },
    ]);
  });

  it("records each byte of OTIR at BC once B is decremented", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [LD_HL_NN, 0x00, 0x50, ED, OTIR, RET],
        },
        { address: 0x5000, bytes: [0x11, 0x22, 0x33] },
      ],
      symbols: { send: 0x4000 },
    });

    const run = program.run("send", { registers: { bc: 0x03c0 } });

    expect(run.portWrites).toEqual([
      { address: 0x02c0, value: 0x11 },
      { address: 0x01c0, value: 0x22 },
      { address: 0x00c0, value: 0x33 },
    ]);
  });
});

describe("the Port reads of a Run", () => {
  it("returns to IN the value the test supplies for the port", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ED, IN_A_C, RET] }],
      symbols: { read_ppi_b: 0x4000 },
    });

    const run = program.run("read_ppi_b", {
      registers: { bc: 0xf500 },
      ports: { 0xf500: [0x42] },
    });

    expect(run.registers.a).toBe(0x42);
  });

  it("fails on a port the test did not supply, naming the port and the PC, with the failure report", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [NOP, ED, IN_A_C, RET] }],
      symbols: { read_ppi_b: 0x4000 },
    });

    const failure = () =>
      program.run("read_ppi_b", { registers: { bc: 0xf500 } });

    expect(failure).toThrow(
      /^The Routine read port #F500 \(key #F500\) at #4001, which the test did not supply\n/,
    );
    expect(failure).toThrow(/#4001 +read_ppi_b\+1 +IN A,\(C\)\n/);
    expect(failure).toThrow(/PC #4001/);
  });

  it("fails on a read past the end of the port's values, naming the port and the PC", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [ED, IN_A_C, ED, IN_A_C, ED, IN_A_C, RET] },
      ],
      symbols: { read_ppi_b: 0x4000 },
    });

    const failure = () =>
      program.run("read_ppi_b", {
        registers: { bc: 0xf500 },
        ports: { 0xf500: [0x00, 0x01] },
      });

    expect(failure).toThrow(
      /^The Routine read port #F500 \(key #F500\) at #4004, past the end of its 2 values\n/,
    );
    expect(failure).toThrow(/PC #4004/);
  });

  it("returns to IN what the test's function computes from the Port writes so far", async () => {
    const program = await load({
      blocks: [
        {
          address: 0x4000,
          bytes: [LD_A_N, 0x0e, ED, OUT_C_A, ED, IN_A_C, RET],
        },
      ],
      symbols: { read_psg: 0x4000 },
    });

    const run = program.run("read_psg", {
      registers: { bc: 0xf400 },
      ports: {
        0xf400: ({ writes }) => (writes.at(-1)?.value === 0x0e ? 0xfb : 0xff),
      },
    });

    expect(run.registers.a).toBe(0xfb);
  });

  it("reads each byte of INIR at BC before B is decremented, so its key changes", async () => {
    const program = await load({
      blocks: [
        { address: 0x4000, bytes: [LD_HL_NN, 0x00, 0x50, ED, INIR, RET] },
      ],
      symbols: { receive: 0x4000 },
    });

    const run = program.run("receive", {
      registers: { bc: 0x02c0 },
      ports: { 0x0200: [0x11], 0x0100: [0x22] },
    });

    expect(run.memory(0x5000, 2)).toEqual([0x11, 0x22]);
  });

  it("gives the test's function the full port address read", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ED, IN_A_C, RET] }],
      symbols: { read_ppi_a: 0x4000 },
    });

    const run = program.run("read_ppi_a", {
      registers: { bc: 0xf4c0 },
      ports: { 0xf400: ({ address }) => address & 0xff },
    });

    expect(run.registers.a).toBe(0xc0);
  });

  it("lets a Routine poll a port until bit 0 is set, as when waiting for VSYNC", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: WAIT_VSYNC }],
      symbols: { wait_vsync: 0x4000 },
    });

    const run = program.run("wait_vsync", {
      ports: { 0xf500: [0x00, 0x00, 0x01] },
    });

    expect(run.registers.a).toBe(0x00);
    expect(run.flags.c).toBe(true);
  });

  it("matches a port by its high byte by default, whatever C holds", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: WAIT_VSYNC }],
      symbols: { wait_vsync: 0x4000 },
    });

    const run = program.run("wait_vsync", {
      registers: { c: 0x3c },
      ports: { 0xf500: [0x00, 0x01] },
    });

    expect(run.flags.c).toBe(true);
  });

  it("matches the full port address under the port mask #FFFF the Run sets", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ED, IN_A_C, RET] }],
      symbols: { read_fdc_data: 0x4000 },
    });

    const run = program.run("read_fdc_data", {
      registers: { bc: 0xfb7f },
      portMask: 0xffff,
      ports: { 0xfb7e: [0x80], 0xfb7f: [0x42] },
    });

    expect(run.registers.a).toBe(0x42);
  });

  it("refuses a port mask wider than 16 bits", async () => {
    const program = await loadNothing();

    expect(() => program.run("nothing", { portMask: 0x10000 })).toThrow(
      /^The port mask cannot be 65536: it takes #0000 to #FFFF$/,
    );
  });

  it("refuses a port with bits outside the port mask, which no Port read would match", async () => {
    const program = await loadNothing();

    expect(() => program.run("nothing", { ports: { 0xfb7f: [0x42] } })).toThrow(
      /^The port #FB7F has bits outside the port mask #FF00, so no Port read would match it$/,
    );
  });

  it("refuses a value a port could not return, naming the port", async () => {
    const program = await loadNothing();

    expect(() =>
      program.run("nothing", { ports: { 0xf500: [0x00, 0x100] } }),
    ).toThrow(/^A value read at port #F500 cannot be 256: it takes 0 to 255$/);
  });

  it("fails when the test's function returns a value a port could not, with the failure report", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ED, IN_A_C, RET] }],
      symbols: { read_ppi_a: 0x4000 },
    });

    const failure = () =>
      program.run("read_ppi_a", {
        registers: { bc: 0xf4c0 },
        ports: { 0xf400: () => 0x100 },
      });

    expect(failure).toThrow(
      /^The Routine read port #F4C0 \(key #F400\) at #4000, whose function returned 256: it takes 0 to 255\n/,
    );
    expect(failure).toThrow(/#4000 +read_ppi_a +IN A,\(C\)\n/);
  });

  it("fails when the test's function throws, with its message and the failure report", async () => {
    const program = await load({
      blocks: [{ address: 0x4000, bytes: [ED, IN_A_C, RET] }],
      symbols: { read_ppi_a: 0x4000 },
    });

    const failure = () =>
      program.run("read_ppi_a", {
        registers: { bc: 0xf4c0 },
        ports: {
          0xf400: () => {
            throw new Error("no PSG register selected");
          },
        },
      });

    expect(failure).toThrow(
      /^The Routine read port #F4C0 \(key #F400\) at #4000, whose function failed: no PSG register selected\n/,
    );
    expect(failure).toThrow(/#4000 +read_ppi_a +IN A,\(C\)\n/);
  });

  it.each([
    ["1.5", 1.5],
    ["-1", -1],
    ["65536", 0x10000],
    ["NaN", Number.NaN],
  ])("refuses the port %s, which is not an address", async (shown, port) => {
    const program = await loadNothing();

    expect(() =>
      program.run("nothing", { portMask: 0xffff, ports: { [port]: [0] } }),
    ).toThrow(`A port cannot be ${shown}: it takes #0000 to #FFFF`);
  });

  it("refuses a port given neither values nor a function", async () => {
    const program = await loadNothing();

    expect(() =>
      // @ts-expect-error: a single value instead of a list
      program.run("nothing", { ports: { 0xf500: 5 } }),
    ).toThrow(
      /^The port #F500 cannot be given 5: it takes a list of values or a function$/,
    );
  });
});
