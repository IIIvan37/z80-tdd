import { beforeAll, describe, expect, it } from "vitest";
import { loadProgram, memoryMatchers, type Program } from "z80-tdd";

expect.extend(memoryMatchers);

describe("clear_buffer", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram(); // assembles the source of z80-tdd.config.ts
  });

  it("fills the buffer with zeros, and nothing else", () => {
    const run = program.run("clear_buffer", {
      memory: [{ at: "buffer", bytes: Array(16).fill(0xaa) }],
    });

    expect(run.memory("buffer", 16)).toEqual(Array(16).fill(0));
    expect(run).toChangeOnly(program.range("buffer", 16));
    expect(run.registers.hl).toBe(program.address("buffer") + 16);
    // ld hl,nn 3 · ld bc,nn 3 · 15 turns of the loop, 12 each · the last turn 11 · ret 3
    expect(run.nops).toBe(200);
  });
});
