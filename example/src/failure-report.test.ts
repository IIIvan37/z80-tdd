import { beforeAll, describe, expect, it } from "vitest";
import { loadProgram, type Program } from "z80-tdd";

describe("a Routine that never returns", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram();
  });

  // The README shows this failure report.
  it("fails its Run with the last instructions and the registers", () => {
    expect(() =>
      program.run("clear_buffer_buggy", { nopLimit: 500 }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: The Run reached its NOP limit of 500 NOPs

      Last 16 instructions executed:
        #404C  CLEAR_BUFFER_BUGGY.LOOP    LD (HL),#00
        #404E  CLEAR_BUFFER_BUGGY.LOOP+2  INC HL
        #404F  CLEAR_BUFFER_BUGGY.LOOP+3  LD A,B
        #4050  CLEAR_BUFFER_BUGGY.LOOP+4  OR C
        #4051  CLEAR_BUFFER_BUGGY.LOOP+5  JR NZ,#404C
        #404C  CLEAR_BUFFER_BUGGY.LOOP    LD (HL),#00
        #404E  CLEAR_BUFFER_BUGGY.LOOP+2  INC HL
        #404F  CLEAR_BUFFER_BUGGY.LOOP+3  LD A,B
        #4050  CLEAR_BUFFER_BUGGY.LOOP+4  OR C
        #4051  CLEAR_BUFFER_BUGGY.LOOP+5  JR NZ,#404C
        #404C  CLEAR_BUFFER_BUGGY.LOOP    LD (HL),#00
        #404E  CLEAR_BUFFER_BUGGY.LOOP+2  INC HL
        #404F  CLEAR_BUFFER_BUGGY.LOOP+3  LD A,B
        #4050  CLEAR_BUFFER_BUGGY.LOOP+4  OR C
        #4051  CLEAR_BUFFER_BUGGY.LOOP+5  JR NZ,#404C
        #404C  CLEAR_BUFFER_BUGGY.LOOP    LD (HL),#00

      Registers:
        AF #1000  BC #0010  DE #0000  HL #4040
        AF' #0000  BC' #0000  DE' #0000  HL' #0000
        IX #0000  IY #0000  SP #BFFE  PC #404E
        I #00  R #78]
    `);
  });
});
