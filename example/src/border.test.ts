import { beforeAll, describe, expect, it } from "vitest";
import { loadProgram, type Program, runMatchers } from "z80-tdd";

expect.extend(runMatchers);

const GATE_ARRAY = 0x7f10;
const SET_COLOUR = 0x40;
const BLACK = 0x14;

describe("set_border", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram();
  });

  it("selects the border, then sends the colour to the Gate Array", () => {
    const run = program.run("set_border", { registers: { a: BLACK } });

    expect(run.portWrites).toEqual([
      { address: GATE_ARRAY, value: 0x10 },
      { address: GATE_ARRAY, value: SET_COLOUR | BLACK },
    ]);
    expect(run).toLeaveMemoryUnchanged();
  });
});
