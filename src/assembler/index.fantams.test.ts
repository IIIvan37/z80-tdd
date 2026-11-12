import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fantamsAssembler } from "./index.ts";

const FIXTURES = join(import.meta.dirname, "fixtures-fantams");

describe("the FantAMS Assembler, with the real fantams", () => {
  it("assembles a Routine at its ORG address, with its label", async () => {
    const assembly = await fantamsAssembler().assemble("routine.asm", FIXTURES);

    expect(assembly).toEqual({
      blocks: [{ address: 0x4000, bytes: [0x87, 0xc9] }],
      symbols: { double: 0x4000 },
    });
  });

  it("gives each ORG block its own load address", async () => {
    const assembly = await fantamsAssembler().assemble(
      "several-orgs.asm",
      FIXTURES,
    );

    expect(assembly).toEqual({
      blocks: [
        { address: 0x4000, bytes: [0x3a, 0x00, 0xc0, 0xc9] },
        { address: 0xc000, bytes: [0x07] },
      ],
      symbols: { start: 0x4000, table: 0xc000 },
    });
  });

  it("loads a block at the address it is stored at, not the one it runs at", async () => {
    const assembly = await fantamsAssembler().assemble(
      "logical-org.asm",
      FIXTURES,
    );

    expect(assembly).toEqual({
      blocks: [
        { address: 0x4000, bytes: [0xc9] },
        { address: 0x8000, bytes: [0x3a, 0x00, 0xc0, 0xc9] },
      ],
      symbols: { start: 0x4000, moved: 0xc000 },
    });
  });

  it("gives the symbols defined by EQU along with the labels", async () => {
    const assembly = await fantamsAssembler().assemble("equ.asm", FIXTURES);

    expect(assembly.symbols).toEqual({ start: 0x4000, buffer: 0x9000 });
  });

  it("opens each INCLUDE from the source file's folder, even a nested one", async () => {
    const assembly = await fantamsAssembler().assemble(
      "program/main.asm",
      FIXTURES,
    );

    expect(assembly).toEqual({
      blocks: [
        { address: 0x4000, bytes: [0xcd, 0x04, 0x40, 0xc9, 0xaf, 0xc9] },
      ],
      symbols: { start: 0x4000, clear: 0x4004 },
    });
  });

  it("leaves out the bytes an ALIGN skips", async () => {
    const assembly = await fantamsAssembler().assemble("align.asm", FIXTURES);

    expect(assembly.blocks).toEqual([
      { address: 0x4000, bytes: [0x00] },
      { address: 0x4008, bytes: [0x07] },
    ]);
  });

  it("loads no byte for an uninit section, but gives its labels", async () => {
    const assembly = await fantamsAssembler().assemble("uninit.asm", FIXTURES);

    expect(assembly).toEqual({ blocks: [], symbols: { buffer: 0x9000 } });
  });

  it("fails with FantAMS's message, file and line", async () => {
    await expect(
      fantamsAssembler().assemble("error.asm", FIXTURES),
    ).rejects.toThrow(
      /^FantAMS could not assemble error\.asm:\n\S*error\.asm:3: error: unknown symbol 'nowhere'$/,
    );
  });

  it("fails on a section without ORG, which FantAMS's linker would place", async () => {
    await expect(
      fantamsAssembler().assemble("section.asm", FIXTURES),
    ).rejects.toThrow(
      "FantAMS cannot assemble section.asm without its linker: z80-tdd needs an ORG for each section and no extern symbol",
    );
  });

  it("fails on an extern symbol, whose address FantAMS's linker would write", async () => {
    await expect(
      fantamsAssembler().assemble("extern.asm", FIXTURES),
    ).rejects.toThrow(
      /^FantAMS cannot assemble extern\.asm without its linker/,
    );
  });

  it("fails on a .fo object of a version it does not read, naming it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "z80-tdd-fake-fantams-"));
    try {
      // Called as `fantams <source> -o <object>`, it writes a version 3 header.
      const fake = join(dir, "fantams");
      await writeFile(fake, '#!/bin/sh\necho "fantams-object 3" > "$3"\n', {
        mode: 0o755,
      });

      await expect(
        fantamsAssembler({ path: fake }).assemble("routine.asm", FIXTURES),
      ).rejects.toThrow(
        "FantAMS wrote a .fo object of version 3 for routine.asm: z80-tdd reads version 2",
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("fails with the reason fantams could not run when it names no line", async () => {
    const notExecutable = join(FIXTURES, "routine.asm");

    await expect(
      fantamsAssembler({ path: notExecutable }).assemble(
        "routine.asm",
        FIXTURES,
      ),
    ).rejects.toThrow(/^FantAMS could not assemble routine\.asm:\n.*EACCES/);
  });

  it("fails when fantams cannot be found, saying where to get it", async () => {
    const assembler = fantamsAssembler({ path: "/no/such/dir/fantams" });

    await expect(assembler.assemble("routine.asm", FIXTURES)).rejects.toThrow(
      'FantAMS was not found at "/no/such/dir/fantams": build it from https://github.com/sikorama/fantams, then put it on the PATH or give its path',
    );
  });
});
