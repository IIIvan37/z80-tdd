# z80-tdd

Write the Z80 assembly of an Amstrad CPC project test-first. Each Vitest test runs a Routine of your real project on an emulated Z80, then checks the registers, flags, memory and duration in NOPs it leaves behind.

> **Status:** v1 in progress, not on npm yet. Registers, flags, memory, NOP counts, the NOP limit, ports, RASM and the configuration file work. Stubs and an example project are still to come.

## What a test looks like

`src/clear.asm`, assembled by RASM:

```z80
 org #4000
clear_buffer:
 ld hl,buffer
 ld bc,16
.loop:
 ld (hl),0
 inc hl
 dec bc
 ld a,b
 or c
 jr nz,.loop
 ret
buffer:
 defs 16
```

`src/clear.test.ts`:

```ts
import { beforeAll, describe, expect, it } from "vitest";
import { loadProgram, memoryMatchers, type Program } from "z80-tdd";

expect.extend(memoryMatchers);

describe("clear_buffer", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram({ source: "src/clear.asm" });
  });

  it("fills the buffer with zeros, and nothing else", () => {
    const run = program.run("clear_buffer", {
      memory: [{ at: "buffer", bytes: Array(16).fill(0xaa) }],
    });

    expect(run.memory("buffer", 16)).toEqual(Array(16).fill(0));
    expect(run).toChangeOnly(program.range("buffer", 16));
    expect(run.registers.hl).toBe(program.address("buffer") + 16);
    expect(run.nops).toBe(200);
  });
});
```

## Installation

z80-tdd needs Node.js 24 or later and Vitest.

1. Add z80-tdd and Vitest to the CPC project, as dev dependencies, once z80-tdd is published:

   ```sh
   pnpm add -D z80-tdd vitest
   ```

2. Install RASM, the Assembler z80-tdd supports. Download it from [the RASM releases](https://github.com/EdouardBERGE/rasm/releases), then put `rasm` on the PATH. z80-tdd is tested with RASM v3.3.1.

## The configuration file

`z80-tdd.config.ts`, at the root of the CPC project, holds the settings shared by every test file. Each setting is optional.

```ts
import { defineConfig, rasmAssembler } from "z80-tdd";

export default defineConfig({
  assembler: rasmAssembler({ path: "tools/rasm" }), // `rasm` on the PATH by default
  source: "src/main.asm",                           // what loadProgram() assembles
  sp: 0xc000,                                       // the SP a Run starts with; #C000 by default
  nopLimit: 1_000_000,                              // the longest a Run may last; 1,000,000 NOPs by default
  portMask: 0xff00,                                 // the bits a Port read matches on; #FF00 by default
});
```

- A test file overrides any setting: `loadProgram({ source: "src/clear.asm" })`.
- A Run overrides the SP, the NOP limit and the Port mask: `program.run("clear_buffer", { registers: { sp: 0x8000 }, nopLimit: 500 })`.
- z80-tdd reads the file in the working directory, where Vitest runs. A path to `rasm` that holds a folder is read from there too.
- A setting it does not know, or a value it refuses, fails the test and names the setting.

## Running a Routine

`loadProgram()` assembles the source file and loads the Program at its real addresses, in 64 KB of memory. Labels match whatever their case.

`program.run(label, options)` runs the Routine at `label` until it returns to the caller. Each Run starts from a fresh copy of the Program.

| Option | What it sets before the Run |
|---|---|
| `registers` | Any register but PC, which starts at the label: `{ a: 7, hl: 0xc000, ixh: 1, afPrime: 0 }` |
| `flags` | Bits of F, after `registers`: `{ c: true, z: false }` |
| `memory` | Bytes at a label or an address: `[{ at: "table", bytes: [1, 2] }, { at: 0x5000, bytes: [3] }]` |
| `nopLimit` | The longest the Run may last, in NOPs |
| `ports` | What each `IN` returns, by port: values in order, or a function (see below) |
| `portMask` | The bits of a port address a Port read matches on |

| Result | What it holds |
|---|---|
| `registers`, `flags` | The CPU state once the Routine has returned |
| `nops` | The duration in NOPs, from the first instruction to the final `RET` included |
| `nopsWithCall` | `nops` plus the 5 NOPs of the `CALL` that enters the Routine |
| `memoryChanges` | Each byte the Run changed, as `{ address, before, after }`, except the stack the Routine used |
| `memory(at, length)` | The bytes at a label or an address once the Routine has returned |
| `portWrites` | Each `OUT`, in order, as `{ address, value }` with the full 16-bit port address |

### Ports

A test supplies what each `IN` returns. A Port read matches its address under the Port mask, `#FF00` by default, as the CPC decodes: the key `0xf500` answers `IN A,(C)` with B at `#F5`, whatever C holds ([ADR 0007](docs/adr/0007-port-reads-match-on-a-port-mask.md)).

```ts
// wait_vsync polls PPI port B until bit 0 is set
program.run("wait_vsync", { ports: { 0xf500: [0x00, 0x00, 0x01] } });

// the keyboard line depends on the PSG register the Routine selected
program.run("read_keys", {
  ports: { 0xf400: ({ address, writes }) => (writes.at(-1)?.value === 0x0e ? 0xfb : 0xff) },
});
```

A read from a port the test did not supply, or past the end of its values, fails the Run with the port address and the PC. Set `portMask: 0xffff` to match the full address, as the FDC ports `#FB7E` and `#FB7F` need.

Two Matchers check Memory changes: `toChangeOnly(program.range(label, length))` and `toLeaveMemoryUnchanged()`. Install them with `expect.extend(memoryMatchers)`.

## When a Run fails

A Run that lasts longer than its NOP limit, or reads a port the test did not supply, fails the test with the last instructions executed and the registers. Here, `clear_buffer` without its `dec bc`:

```text
The Run reached its NOP limit of 500 NOPs

Last 16 instructions executed:
  #4006  CLEAR_BUFFER.LOOP    LD (HL),#00
  #4008  CLEAR_BUFFER.LOOP+2  INC HL
  #4009  CLEAR_BUFFER.LOOP+3  LD A,B
  #400A  CLEAR_BUFFER.LOOP+4  OR C
  #400B  CLEAR_BUFFER.LOOP+5  JR NZ,#4006
  ...

Registers:
  AF #1000  BC #0010  DE #0000  HL #403F
  AF' #0000  BC' #0000  DE' #0000  HL' #0000
  IX #0000  IY #0000  SP #BFFE  PC #4008
  I #00  R #78
```

## How NOPs are counted

A NOP is the CPC unit of time: one microsecond. The CPC stretches each memory access to a multiple of 4 T-states, so a NOP count is not a T-state count divided by 4. z80-tdd counts every instruction with Madram's table measured on a real CPC ([ADR 0002](docs/adr/0002-nops-counted-from-our-own-cpc-table.md)). A conditional instruction counts its taken or not-taken duration, as the Run goes.

## Developing z80-tdd

```sh
pnpm install
pnpm gate        # typecheck, Biome, dependency-cruiser, Vitest
pnpm test:core   # the Z80 core against SingleStepTests, 1.6 million cases
pnpm build:wasm  # rebuilds src/cpu/cell80.wasm; needs the Rust toolchain of wasm/rust-toolchain.toml
```

The RASM contract tests need `rasm` on the PATH. The vocabulary is in [GLOSSARY.md](GLOSSARY.md), the decisions in [docs/adr/](docs/adr/), the modules in [docs/MODULES.md](docs/MODULES.md).

## Credits and licence

- The NOP count of every instruction comes from "Perfectly accurate Z80 flags and CPC timing" by Madram / Overlanders: see [CREDITS.md](CREDITS.md).
- The Z80 core is [cell80-z80](https://github.com/chrishayuk/cell80), MIT or Apache-2.0, compiled to WebAssembly: see [wasm/vendor/cell80-z80/](wasm/vendor/cell80-z80/).
- z80-tdd is under the MIT licence.
