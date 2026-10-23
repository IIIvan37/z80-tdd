import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadProgram, type Program, rasmAssembler } from "./index.ts";

// The table sits in a block of its own at #C000, just above the default SP.
const SOURCE = `
 org #4000
start:
 ld a,(table)
 ret

 org #c000
table:
 defb 7
`;

describe("a Program assembled by RASM", () => {
  let dir: string;
  let program: Program;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "z80-tdd-"));
    await writeFile(join(dir, "main.asm"), SOURCE);
    program = await loadProgram({
      source: join(dir, "main.asm"),
      assembler: rasmAssembler(),
    });
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("runs a Routine that reads a table in another ORG block", () => {
    const run = program.run("start");

    expect(run.registers.a).toBe(7);
  });
});
