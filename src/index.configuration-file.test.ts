import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProgram } from "./index.ts";

const API = pathToFileURL(join(import.meta.dirname, "index.ts")).href;

// `ld a,#2a : ret` at #4000, labelled `set_a`, in main.asm;
// `ld a,#99 : ret` in other.asm.
const ASSEMBLER = `inMemoryAssembler({
  "main.asm": {
    blocks: [{ address: 0x4000, bytes: [0x3e, 0x2a, 0xc9] }],
    symbols: { set_a: 0x4000 },
  },
  "other.asm": {
    blocks: [{ address: 0x4000, bytes: [0x3e, 0x99, 0xc9] }],
    symbols: { set_a: 0x4000 },
  },
})`;

// `ld a,7 : ret`, for the tests that run the real rasm.
const RASM_SOURCE = `
 org #4000
start:
 ld a,7
 ret
`;

describe("the configuration file", () => {
  let cwd: string;
  let project: string;

  beforeEach(async () => {
    cwd = process.cwd();
    project = await mkdtemp(join(tmpdir(), "z80-tdd-config-"));
    process.chdir(project);
  });

  afterEach(async () => {
    process.chdir(cwd);
    await rm(project, { recursive: true, force: true });
  });

  async function configure(settings: string): Promise<void> {
    await writeFile(
      join(project, "z80-tdd.config.ts"),
      `import { defineConfig, inMemoryAssembler, rasmAssembler } from ${JSON.stringify(API)};
export default defineConfig({ ${settings} });
`,
    );
  }

  it("gives loadProgram() its source file and Assembler", async () => {
    await configure(`assembler: ${ASSEMBLER}, source: "main.asm"`);

    const program = await loadProgram();

    expect(program.run("set_a").registers.a).toBe(0x2a);
  });

  it("lets a test file name another source file", async () => {
    await configure(`assembler: ${ASSEMBLER}, source: "main.asm"`);

    const program = await loadProgram({ source: "other.asm" });

    expect(program.run("set_a").registers.a).toBe(0x99);
  });

  it("sets the SP a Run starts with", async () => {
    await configure(`assembler: ${ASSEMBLER}, source: "main.asm", sp: 0x8000`);

    const program = await loadProgram();

    expect(program.run("set_a").registers.sp).toBe(0x8000);
  });

  it("sets the NOP limit of a Run", async () => {
    await configure(`assembler: ${ASSEMBLER}, source: "main.asm", nopLimit: 4`);

    const program = await loadProgram();

    expect(() => program.run("set_a")).toThrow(/NOP limit of 4 NOPs/);
  });

  it("gives way to the SP and NOP limit of a Run", async () => {
    await configure(
      `assembler: ${ASSEMBLER}, source: "main.asm", sp: 0x8000, nopLimit: 4`,
    );

    const program = await loadProgram();
    const run = program.run("set_a", {
      registers: { sp: 0x9000 },
      nopLimit: 5,
    });

    expect(run.registers.sp).toBe(0x9000);
  });

  it("gives way to the SP and NOP limit of a test file", async () => {
    await configure(
      `assembler: ${ASSEMBLER}, source: "main.asm", sp: 0x8000, nopLimit: 4`,
    );

    const program = await loadProgram({ sp: 0x9000, nopLimit: 5 });

    expect(program.run("set_a").registers.sp).toBe(0x9000);
  });

  it("keeps a setting that a test file leaves undefined", async () => {
    await configure(`assembler: ${ASSEMBLER}, source: "main.asm", sp: 0x8000`);

    // @ts-expect-error: exactOptionalPropertyTypes forbids it, a spread in plain JavaScript does not
    const program = await loadProgram({ sp: undefined });

    expect(program.run("set_a").registers.sp).toBe(0x8000);
  });

  it("fails on an SP that is not an address, naming the setting", async () => {
    await configure(`source: "main.asm", sp: 0x10000`);

    await expect(loadProgram()).rejects.toThrow(
      /"sp" of z80-tdd\.config\.ts cannot be 65536/,
    );
  });

  it("fails on a NOP limit that is not a whole number of NOPs, naming the setting", async () => {
    await configure(`source: "main.asm", nopLimit: 1.5`);

    await expect(loadProgram()).rejects.toThrow(
      /"nopLimit" of z80-tdd\.config\.ts cannot be 1\.5/,
    );
  });

  it("fails on a setting it does not know, naming it", async () => {
    await writeFile(
      join(project, "z80-tdd.config.ts"),
      `export default { source: "main.asm", nopLimits: 10 };\n`,
    );

    await expect(loadProgram()).rejects.toThrow(
      /"nopLimits" of z80-tdd\.config\.ts is not a setting/,
    );
  });

  it("fails on a source that is not a file name, naming the setting", async () => {
    await configure(`source: 42`);

    await expect(loadProgram()).rejects.toThrow(
      /"source" of z80-tdd\.config\.ts cannot be 42/,
    );
  });

  it("fails on an assembler that is not an Assembler, naming the setting", async () => {
    await configure(`assembler: "/opt/rasm", source: "main.asm"`);

    await expect(loadProgram()).rejects.toThrow(
      /"assembler" of z80-tdd\.config\.ts cannot be "\/opt\/rasm".*rasmAssembler/,
    );
  });

  it("names itself when it fails to load", async () => {
    await writeFile(
      join(project, "z80-tdd.config.ts"),
      `throw new Error("boom");\n`,
    );

    await expect(loadProgram()).rejects.toThrow(
      /z80-tdd\.config\.ts failed to load: boom/,
    );
  });

  it("fails without a default export, saying how to write one", async () => {
    await writeFile(
      join(project, "z80-tdd.config.ts"),
      `export const config = { source: "main.asm" };\n`,
    );

    await expect(loadProgram()).rejects.toThrow(
      /z80-tdd\.config\.ts has no default export.*export default defineConfig/,
    );
  });

  it("checks the settings a test file gives as it checks its own", async () => {
    await expect(
      // @ts-expect-error: an Assembler wrongly given as its path
      loadProgram({ assembler: "/opt/rasm", source: "main.asm" }),
    ).rejects.toThrow(/"assembler" of loadProgram\(\) cannot be "\/opt\/rasm"/);
    await expect(
      // @ts-expect-error: a misspelt setting
      loadProgram({ source: "main.asm", nopLimits: 10 }),
    ).rejects.toThrow(/"nopLimits" of loadProgram\(\) is not a setting/);
  });

  it("is missing, so loadProgram() without a source file says where to set one", async () => {
    await expect(loadProgram()).rejects.toThrow(
      /"source".*z80-tdd\.config\.ts/,
    );
  });

  it("names no Assembler, so loadProgram() runs rasm on the PATH", async () => {
    await writeFile(join(project, "main.asm"), RASM_SOURCE);
    await configure(`source: "main.asm"`);

    const program = await loadProgram();

    expect(program.run("start").registers.a).toBe(7);
  });

  it("gives the path to rasm from the project root", async () => {
    const rasm = (process.env.PATH ?? "")
      .split(delimiter)
      .map((dir) => join(dir, "rasm"))
      .find(existsSync);
    if (rasm === undefined) {
      throw new Error("This test needs rasm on the PATH");
    }
    await mkdir(join(project, "tools"));
    await symlink(rasm, join(project, "tools", "rasm"));
    await writeFile(join(project, "main.asm"), RASM_SOURCE);
    await configure(
      `assembler: rasmAssembler({ path: "tools/rasm" }), source: "main.asm"`,
    );

    const program = await loadProgram();

    expect(program.run("start").registers.a).toBe(7);
  });
});
