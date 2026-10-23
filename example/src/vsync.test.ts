import { beforeAll, describe, expect, it } from "vitest";
import { loadProgram, type Program } from "z80-tdd";

const PPI_PORT_B = 0xf500;

describe("wait_vsync", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram();
  });

  it("polls PPI port B until the frame flyback sets bit 0", () => {
    const run = program.run("wait_vsync", {
      ports: { [PPI_PORT_B]: [0x00, 0x00, 0x01] },
    });

    expect(run.flags.c).toBe(true);
    // ld b,n 2 · twice in a,(c) 4 + rra 1 + jr nc taken 3 · in, rra, jr nc not taken 2 · ret 3
    expect(run.nops).toBe(28);
  });
});
