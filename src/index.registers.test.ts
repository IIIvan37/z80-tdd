import { describe, expect, it } from "vitest";
import { inMemoryAssembler, loadProgram, runMatchers } from "./index.ts";

expect.extend(runMatchers);

const LD_A_N = 0x3e;
const LD_HL_NN = 0x21;
const RET = 0xc9;

// Runs `ld a,7 : ld hl,#c000 : ret`.
async function runSet() {
  const program = await loadProgram({
    source: "main.asm",
    assembler: inMemoryAssembler({
      "main.asm": {
        blocks: [
          { address: 0x4000, bytes: [LD_A_N, 0x07, LD_HL_NN, 0x00, 0xc0, RET] },
        ],
        symbols: { set: 0x4000 },
      },
    }),
  });
  return program.run("set");
}

describe("the matcher toHaveRegisters", () => {
  it("passes when the registers it names match, whatever the others hold", async () => {
    const run = await runSet();

    expect(run).toHaveRegisters({ a: 0x07, hl: 0xc000 });
    expect(() =>
      expect(run).not.toHaveRegisters({ a: 0x07, hl: 0xc000 }),
    ).toThrow("Registers match: A #07, HL #C000");
  });

  it("fails naming only the registers that differ, in CPC hexadecimal", async () => {
    const run = await runSet();

    expect(() =>
      expect(run).toHaveRegisters({ a: 0x2a, hl: 0xc000, afPrime: 0x1234 }),
    ).toThrow(
      "Registers differ:\n  A    expected #2A, received #07\n  AF'  expected #1234, received #0000",
    );
  });

  it.each([
    ["a name that is not a register", { foo: 1 }, /"foo" is not a register/],
    ["a value left undefined", { a: undefined }, /A cannot be undefined/],
    ["a value wider than the register", { a: 0x1ff }, /A cannot be 511/],
  ])("fails on %s, naming it", async (_, expected, message) => {
    const run = await runSet();

    expect(() => expect(run).toHaveRegisters(expected as never)).toThrow(
      message,
    );
    expect(() => expect(run).not.toHaveRegisters(expected as never)).toThrow(
      message,
    );
  });

  it("fails when it names no register", async () => {
    const run = await runSet();

    expect(() => expect(run).toHaveRegisters({})).toThrow(/names no register/);
  });
});
