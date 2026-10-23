import { beforeAll, describe, expect, it } from "vitest";
import { loadProgram, type Program } from "z80-tdd";

const RED = 0x0c;

describe("next_frame", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram();
  });

  it("waits for the frame flyback once, then turns the border red", () => {
    const run = program.run("next_frame", {
      stubs: [{ at: "wait_vsync", nops: 2_000 }],
    });

    expect(run.stubCalls).toHaveLength(1);
    expect(run.portWrites.at(-1)?.value).toBe(0x40 | RED);
    expect(run.nops).toBeGreaterThan(2_000);
  });
});
