import { describe, expect, it } from "vitest";
import { inMemoryAssembler, loadProgram, runMatchers } from "./index.ts";

expect.extend(runMatchers);

const LD_A_N = 0x3e;
const LD_HL_NN = 0x21;
const RET = 0xc9;

// `ld a,7 : ld hl,#c000 : ret`, labelled `set`.
function load() {
  return loadProgram({
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
}

describe("the matcher toHaveRegisters", () => {
  it("passes when the registers it names match, whatever the others hold", async () => {
    const program = await load();

    const run = program.run("set");

    expect(run).toHaveRegisters({ a: 0x07, hl: 0xc000 });
    expect(() =>
      expect(run).not.toHaveRegisters({ a: 0x07, hl: 0xc000 }),
    ).toThrow("Registers match: A #07, HL #C000");
  });

  it("fails naming only the registers that differ, in CPC hexadecimal", async () => {
    const program = await load();

    const run = program.run("set");

    expect(() =>
      expect(run).toHaveRegisters({ a: 0x2a, hl: 0xc000, afPrime: 0x1234 }),
    ).toThrow(
      "Registers differ:\n  A    expected #2A, received #07\n  AF'  expected #1234, received #0000",
    );
  });
});
