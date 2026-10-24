# z80-tdd

Write the Z80 assembly of an Amstrad CPC project test-first. Each Vitest test runs a Routine of your real project on an emulated Z80, then checks the registers, flags, memory and duration in NOPs it leaves behind.

> **Status:** 0.1.0, the first release, published as a GitHub release, not on npm. Registers, flags, memory, NOP counts, the NOP limit, ports, Stubs, RASM and the configuration file work. [example/](example/) is a small CPC project tested with each of them. See [Limits](#limits) for what z80-tdd does not do yet.

## What a test looks like

From [example/](example/). `src/main.asm`, the source file RASM assembles, places the Program and includes each Routine:

```z80
 org #4000
 include "clear.asm"
 include "vsync.asm"
 ...
```

`src/clear.asm`:

```z80
; Fills the 16 bytes of buffer with zeros.
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
import { loadProgram, type Program, runMatchers } from "z80-tdd";

expect.extend(runMatchers);

describe("clear_buffer", () => {
  let program: Program;

  beforeAll(async () => {
    program = await loadProgram(); // assembles the source of z80-tdd.config.ts
  });

  it("fills the buffer with zeros, and nothing else", () => {
    const run = program.run("clear_buffer", {
      memory: [{ at: "buffer", bytes: Array(16).fill(0xaa) }],
    });

    expect(run.memory("buffer", 16)).toEqual(Array(16).fill(0));
    expect(run).toChangeOnly(program.range("buffer", 16));
    expect(run).toHaveRegisters({ hl: program.address("buffer") + 16 });
    // ld hl,nn 3 · ld bc,nn 3 · 15 turns of the loop, 12 each · the last turn 11 · ret 3
    expect(run.nops).toBe(200);
  });
});
```

## Installation

z80-tdd needs Node.js 24 or later and Vitest.

1. Add z80-tdd and Vitest to the CPC project, as dev dependencies. z80-tdd comes from the tarball of [its GitHub release](https://github.com/IIIvan37/z80-tdd/releases/tag/v0.1.0):

   ```sh
   pnpm add -D https://github.com/IIIvan37/z80-tdd/releases/download/v0.1.0/z80-tdd-0.1.0.tgz vitest
   ```

2. Install RASM, the Assembler z80-tdd supports. Download it from [the RASM releases](https://github.com/EdouardBERGE/rasm/releases), then put `rasm` on the PATH. z80-tdd is tested with RASM v3.3.1.

3. Write `z80-tdd.config.ts` at the root of the CPC project, with at least the source file to assemble (see below):

   ```ts
   import { defineConfig } from "z80-tdd";

   export default defineConfig({ source: "src/main.asm" });
   ```

4. Write a first test, such as `src/clear.test.ts` above, then run Vitest from the root of the project:

   ```sh
   pnpm vitest run
   ```

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
- z80-tdd reads the nearest `z80-tdd.config.ts` in the folder where Vitest runs or in a folder above it. That folder is the project root: `source`, and a path to `rasm` that holds a folder, start from there.
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
| `stubs` | Code the Routine calls that the Run does not execute, at a label or an address (see below) |

| Result | What it holds |
|---|---|
| `registers`, `flags` | The CPU state once the Routine has returned |
| `nops` | The duration in NOPs, from the first instruction to the final `RET` included |
| `nopsWithCall` | `nops` plus the 5 NOPs of the `CALL` that enters the Routine |
| `memoryChanges` | Each byte the Run changed, as `{ address, before, after }`, except the stack the Routine used |
| `memory(at, length)` | The bytes at a label or an address once the Routine has returned |
| `portWrites` | Each `OUT`, in order, as `{ address, value }` with the full 16-bit port address |
| `stubCalls` | Each call to a Stub, in order, as `{ at, registers }`: the Stub's `at` and the registers as PC reached it |

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

### Stubs

A Stub stands in for code the test does not run: another routine of the project, or the firmware, whose ROM is not loaded. When PC reaches a Stub, the Run records the call, sets the Stub's `registers` then its `flags`, and returns to the caller as a `RET` would.

```ts
const run = program.run("game_loop", {
  stubs: [
    { at: "play_sound" },
    { at: "read_keys", registers: { a: 0xfb }, nops: 120 },
    { at: 0xbb5a },                                  // TXT OUTPUT, in the firmware
  ],
});
expect(run.stubCalls).toMatchObject([{ at: "play_sound", registers: { a: 3 } }]);
```

A call to a Stub costs 3 NOPs, the price of a `RET`, on top of the `CALL` the Routine paid; `nops` sets another duration. A Stub cannot set SP or PC, which its return sets. A failure report shows each call to a Stub as a `Stub` line among the last instructions.

Two Matchers check Memory changes: `toChangeOnly(program.range(label, length))` and `toLeaveMemoryUnchanged()`. A third, `toHaveRegisters({ a: 0x2a, hl: 0xc000 })`, checks the registers it names and prints the ones that differ in CPC hexadecimal. Install them with `expect.extend(runMatchers)`.

## When a Run fails

A Run that lasts longer than its NOP limit, or reads a port the test did not supply, fails the test with the last instructions executed and the registers. Here, `clear_buffer` without its `dec bc`, from [example/src/failure-report.test.ts](example/src/failure-report.test.ts):

```text
The Run reached its NOP limit of 500 NOPs

Last 16 instructions executed:
  #404C  CLEAR_BUFFER_BUGGY.LOOP    LD (HL),#00
  #404E  CLEAR_BUFFER_BUGGY.LOOP+2  INC HL
  #404F  CLEAR_BUFFER_BUGGY.LOOP+3  LD A,B
  #4050  CLEAR_BUFFER_BUGGY.LOOP+4  OR C
  #4051  CLEAR_BUFFER_BUGGY.LOOP+5  JR NZ,#404C
  ...

Registers:
  AF #1000  BC #0010  DE #0000  HL #4040
  AF' #0000  BC' #0000  DE' #0000  HL' #0000
  IX #0000  IY #0000  SP #BFFE  PC #404E
  I #00  R #78
```

## The example project

[example/](example/) is a CPC project with its own `z80-tdd.config.ts`. Its tests assemble the Program with the real RASM and run on z80-tdd as built for its release tarball, from `dist/`.

| Routine | What its test checks |
|---|---|
| `clear_buffer` | Registers, Memory changes, NOPs |
| `wait_vsync` | Port reads from PPI port B, NOPs of a conditional jump |
| `set_border` | Port writes to the Gate Array, no Memory change |
| `print_string` | A Stub at the firmware's `TXT OUTPUT` (`#BB5A`) and its calls |
| `next_frame` | A Stub at the label `wait_vsync`, with its own duration |
| `clear_buffer_buggy` | The failure report above, as an inline snapshot |

## How NOPs are counted

A NOP is the CPC unit of time: one microsecond. The CPC stretches each memory access to a multiple of 4 T-states, so a NOP count is not a T-state count divided by 4. z80-tdd counts every instruction with Madram's table measured on a real CPC ([ADR 0002](docs/adr/0002-nops-counted-from-our-own-cpc-table.md)). A conditional instruction counts its taken or not-taken duration, as the Run goes.

## Limits

- `loadProgram()` loads the Program in 64 KB of RAM: no ROM, no firmware, no memory banking, no video. Replace a firmware call with a Stub.
- The Run executes no interrupt. A Routine that waits for one, such as a `HALT`, reaches its NOP limit.
- Port writes stay raw, as a port address and a value. z80-tdd does not decode them into CRTC registers or Gate Array commands.
- RASM is the only Assembler. A test file is TypeScript run by Vitest: there is no standalone runner and no code coverage of Routines.

## Developing z80-tdd

```sh
pnpm install
pnpm gate        # typecheck, Biome, dependency-cruiser, Vitest, then build and test example/
pnpm test:core   # downloads SingleStepTests, then checks the Z80 core against its 1.6 million cases
pnpm build:wasm  # rebuilds src/cpu/cell80.wasm; needs the Rust toolchain of wasm/rust-toolchain.toml
```

The RASM contract tests and the example project need `rasm` on the PATH. The vocabulary is in [GLOSSARY.md](GLOSSARY.md), the decisions in [docs/adr/](docs/adr/), the modules in [docs/MODULES.md](docs/MODULES.md).

## Credits and licence

- The NOP count of every instruction comes from "Perfectly accurate Z80 flags and CPC timing" by Madram / Overlanders: see [CREDITS.md](CREDITS.md).
- The Z80 core is [cell80-z80](https://github.com/chrishayuk/cell80), MIT or Apache-2.0, compiled to WebAssembly: see [wasm/vendor/cell80-z80/](wasm/vendor/cell80-z80/).
- z80-tdd is under the MIT licence: see [LICENSE](LICENSE).
