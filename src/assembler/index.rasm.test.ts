import { copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rasmAssembler } from "./index.ts";

const FIXTURES = join(import.meta.dirname, "fixtures");
const fixture = (name: string) => join(FIXTURES, name);

describe("the RASM Assembler, with the real rasm", () => {
  it("assembles a Routine at its ORG address, with its label", async () => {
    const assembly = await rasmAssembler().assemble("routine.asm", FIXTURES);

    expect(assembly).toEqual({
      blocks: [{ address: 0x4000, bytes: [0x87, 0xc9] }],
      symbols: { DOUBLE: 0x4000 },
    });
  });

  it("gives each ORG block its own load address", async () => {
    const assembly = await rasmAssembler().assemble(
      "several-orgs.asm",
      FIXTURES,
    );

    expect(assembly).toEqual({
      blocks: [
        { address: 0x4000, bytes: [0x3a, 0x00, 0xc0, 0xc9] },
        { address: 0xc000, bytes: [0x07] },
      ],
      symbols: { START: 0x4000, TABLE: 0xc000 },
    });
  });

  it("loads a block at the address it is stored at, not the one it runs at", async () => {
    const assembly = await rasmAssembler().assemble(
      "logical-org.asm",
      FIXTURES,
    );

    expect(assembly).toEqual({
      blocks: [
        { address: 0x4000, bytes: [0xc9] },
        { address: 0x8000, bytes: [0x3a, 0x00, 0xc0, 0xc9] },
      ],
      symbols: { START: 0x4000, MOVED: 0xc000 },
    });
  });

  it("gives the symbols defined by EQU along with the labels", async () => {
    const assembly = await rasmAssembler().assemble("equ.asm", FIXTURES);

    expect(assembly.symbols).toEqual({ START: 0x4000, BUFFER: 0x9000 });
  });

  it("assembles an INCLUDE relative to the including file", async () => {
    const assembly = await rasmAssembler().assemble(
      "with-include.asm",
      FIXTURES,
    );

    expect(assembly).toEqual({
      blocks: [
        { address: 0x4000, bytes: [0xcd, 0x04, 0x40, 0xc9, 0xaf, 0xc9] },
      ],
      symbols: { START: 0x4000, CLEAR: 0x4004 },
    });
  });

  it("assembles a source whose path holds a quote", async () => {
    const dir = await mkdtemp(join(tmpdir(), "z80-tdd-it's-"));
    try {
      await copyFile(fixture("routine.asm"), join(dir, "routine.asm"));

      const assembly = await rasmAssembler().assemble("routine.asm", dir);

      expect(assembly.symbols).toEqual({ DOUBLE: 0x4000 });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails with RASM's message, file and line", async () => {
    await expect(
      rasmAssembler().assemble("error.asm", FIXTURES),
    ).rejects.toThrow(/error\.asm:3\b.*LD needs two parameters/);
  });

  it("fails with the reason rasm could not run when it names no line", async () => {
    const notExecutable = fixture("routine.asm");

    await expect(
      rasmAssembler({ path: notExecutable }).assemble("routine.asm", FIXTURES),
    ).rejects.toThrow(/EACCES/);
  });

  it("fails when rasm cannot be found, saying where to download it", async () => {
    const assembler = rasmAssembler({ path: "/no/such/dir/rasm" });

    await expect(assembler.assemble("routine.asm", FIXTURES)).rejects.toThrow(
      /\/no\/such\/dir\/rasm.*https:\/\/github\.com\/EdouardBERGE\/rasm\/releases/s,
    );
  });
});
