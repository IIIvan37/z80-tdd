import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadProgram } from "./index.ts";

const API = pathToFileURL(join(import.meta.dirname, "index.ts")).href;

// `ld a,#2a : ret` at #4000, labelled `set_a`, in main.asm;
// `ld a,#99 : ret` in other.asm; `in a,(c) : ret`, labelled `read_port`, in ports.asm.
const ASSEMBLER = `inMemoryAssembler({
  "main.asm": {
    blocks: [{ address: 0x4000, bytes: [0x3e, 0x2a, 0xc9] }],
    symbols: { set_a: 0x4000 },
  },
  "other.asm": {
    blocks: [{ address: 0x4000, bytes: [0x3e, 0x99, 0xc9] }],
    symbols: { set_a: 0x4000 },
  },
  "ports.asm": {
    blocks: [{ address: 0x4000, bytes: [0xed, 0x78, 0xc9] }],
    symbols: { read_port: 0x4000 },
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

  it("sets the port mask a Port read matches on", async () => {
    await configure(
      `assembler: ${ASSEMBLER}, source: "ports.asm", portMask: 0xffff`,
    );

    const program = await loadProgram();
    const run = program.run("read_port", {
      registers: { bc: 0xf53c },
      ports: { 0xf500: [0x01], 0xf53c: [0x07] },
    });

    expect(run.registers.a).toBe(0x07);
  });

  it("gives way to the port mask of a test file, and of a Run", async () => {
    await configure(
      `assembler: ${ASSEMBLER}, source: "ports.asm", portMask: 0xffff`,
    );
    const options = { registers: { bc: 0xf53c }, ports: { 0xf500: [0x01] } };

    const testFile = await loadProgram({ portMask: 0xff00 });
    const configured = await loadProgram();

    expect(testFile.run("read_port", options).registers.a).toBe(0x01);
    expect(
      configured.run("read_port", { ...options, portMask: 0xff00 }).registers.a,
    ).toBe(0x01);
  });

  it("keeps a setting that a test file leaves undefined", async () => {
    await configure(`assembler: ${ASSEMBLER}, source: "main.asm", sp: 0x8000`);

    // @ts-expect-error: exactOptionalPropertyTypes forbids it, a spread in plain JavaScript does not
    const program = await loadProgram({ sp: undefined });

    expect(program.run("set_a").registers.sp).toBe(0x8000);
  });

  it.each([
    [
      "an SP that is not an address",
      `source: "main.asm", sp: 0x10000`,
      /"sp" of z80-tdd\.config\.ts cannot be 65536/,
    ],
    [
      "a NOP limit that is not a whole number of NOPs",
      `source: "main.asm", nopLimit: 1.5`,
      /"nopLimit" of z80-tdd\.config\.ts cannot be 1\.5/,
    ],
    [
      "a port mask that is not 16 bits wide",
      `source: "main.asm", portMask: 0x1ff00`,
      /"portMask" of z80-tdd\.config\.ts cannot be 130816/,
    ],
    [
      "a source that is not a file name",
      `source: 42`,
      /"source" of z80-tdd\.config\.ts cannot be 42/,
    ],
    [
      "an assembler that is not an Assembler",
      `assembler: "/opt/rasm", source: "main.asm"`,
      /"assembler" of z80-tdd\.config\.ts cannot be "\/opt\/rasm".*rasmAssembler/,
    ],
  ])("fails on %s, naming the setting", async (_, settings, message) => {
    await configure(settings);

    await expect(loadProgram()).rejects.toThrow(message);
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

  it("is found from a folder below the project root", async () => {
    await configure(`assembler: ${ASSEMBLER}, source: "main.asm"`);
    await mkdir(join(project, "src", "screen"), { recursive: true });
    process.chdir(join(project, "src", "screen"));

    const program = await loadProgram();

    expect(program.run("set_a").registers.a).toBe(0x2a);
  });

  it("gives the source file from the project root", async () => {
    await writeFile(join(project, "main.asm"), RASM_SOURCE);
    await configure(`source: "main.asm"`);
    await mkdir(join(project, "src"));
    process.chdir(join(project, "src"));

    const program = await loadProgram();

    expect(program.run("start").registers.a).toBe(7);
  });

  it("gives a test file's source file from the project root", async () => {
    await writeFile(join(project, "other.asm"), RASM_SOURCE);
    await configure(`source: "main.asm"`);
    await mkdir(join(project, "src"));
    process.chdir(join(project, "src"));

    const program = await loadProgram({ source: "other.asm" });

    expect(program.run("start").registers.a).toBe(7);
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
    await mkdir(join(project, "src"));
    process.chdir(join(project, "src"));

    const program = await loadProgram();

    expect(program.run("start").registers.a).toBe(7);
  });
});
