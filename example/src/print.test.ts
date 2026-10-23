import { beforeAll, describe, expect, it } from "vitest";
import { loadProgram, type Program } from "z80-tdd";

const TXT_OUTPUT = 0xbb5a;

describe("print_string", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram();
  });

  it("sends each character to the firmware, up to the zero byte", () => {
    const run = program.run("print_string", {
      registers: { hl: program.address("message") },
      stubs: [{ at: TXT_OUTPUT }],
    });

    expect(run.stubCalls.map(({ registers }) => registers.a)).toEqual([
      0x48, 0x49,
    ]);
  });
});
