# Z80 core candidates to replace `z80-emulator`

Research date: 2026-10-23. Suite used: [SingleStepTests/z80](https://github.com/SingleStepTests/z80) at commit [`ebe1875`](https://github.com/SingleStepTests/z80/commit/ebe1875d48f374bcfd4b505d8eb8ee751568b5f7) (1,604 files, 1,000 cases each).

## Conclusion

Three cores reach 100 % of SingleStepTests/z80 on everything z80-tdd compares (registers, WZ, IFF1/2, IM, RAM, port reads and writes). We checked this by running them, natively and as WebAssembly in Node:

1. **[cell80-z80](https://crates.io/crates/cell80-z80)** (Rust, MIT OR Apache-2.0). 100 % with no changes, Q included. It builds to a 30 KB `.wasm` file with a 37-line wrapper. It is very young: it has one author and its first commit dates from June 2026.
2. **[floooh/chips `z80.h`](https://github.com/floooh/chips/blob/master/chips/z80.h)** (C, zlib). It passes 99.26 % as it is, and 100 % once we add an 89-line post-step layer that adds Q, the block-repeat flags and the HALT PC. It is mature and widely used. The `.wasm` file is 52 KB.
3. **[redcode/Z80](https://github.com/redcode/Z80)** (C, **LGPL-3.0**). 100 % with no changes. It is the reference: SingleStepTests' own CI validates the test files with it. It is the only candidate that models the Zilog NMOS, Zilog CMOS, NEC NMOS and ST CMOS variants. The LGPL is the obstacle.

On 18.1 million random instructions (random memory and registers, undefined opcodes and prefix chains included), cell80-z80 and floooh with our layer gave exactly the same state as redcode/Z80 after every step.

**Recommendation in one line:** ship cell80-z80 as a prebuilt WebAssembly file now, behind the existing CPU interface, with a pinned, vendored copy of its source. Keep floooh + layer as the fallback. The recommendation section at the end gives the reasons.

## What z80-tdd needs from a core

These needs come from [ADR 0001](../adr/0001-typescript-with-a-pure-javascript-z80-core.md), [ADR 0002](../adr/0002-nops-counted-from-our-own-cpc-table.md) and the [v1 spec](../../.scratch/z80-tdd-v1/spec.md), stories 53, 57, 58 and 59:

- It installs with `npm install` on Linux, macOS and Windows, with no native compilation. Pure JS/TS works, and so does a prebuilt `.wasm` file shipped in the package.
- Its licence can ship inside an MIT package.
- It can step one instruction at a time. A prefix and its instruction count as one step. A repeating block instruction counts as one iteration.
- It gives read/write access to every register: the shadow set, IX/IY, I, R (bit 7 included), WZ/MEMPTR, IFF1/IFF2 and IM, and Q if possible.
- It reads and writes memory through callbacks or a shared 64 KB buffer.
- It handles ports through callbacks that receive the full 16-bit port address.
- It needs no timing, because z80-tdd counts NOPs from its own table.
- It passes SingleStepTests/z80.

## Results at a glance

"SST" means SingleStepTests/z80 at `ebe1875`, compared the way z80-tdd's contract test compares it: every register, WZ, IFF1/2, IM, the RAM the case lists, and port reads and writes with their 16-bit addresses. Q is checked separately.

| Core | Licence | Language | SST, verified by running | Q | WZ | Variants | Step API | `.wasm` built here |
|---|---|---|---|---|---|---|---|---|
| [cell80-z80](https://github.com/chrishayuk/cell80/tree/main/z80) 0.8.0 | [MIT](https://github.com/chrishayuk/cell80/blob/main/LICENSE-MIT) OR [Apache-2.0](https://github.com/chrishayuk/cell80/blob/main/LICENSE-APACHE) | Rust, `no_std` | **1,604,000 / 1,604,000**, Q 0 mismatches | yes | yes | Zilog NMOS only | `cpu.step(&mut bus)`, `Bus` trait | 30.5 KB (11.2 KB gzip) |
| [floooh/chips z80.h](https://github.com/floooh/chips/blob/master/chips/z80.h) | [zlib](https://github.com/floooh/chips/blob/master/LICENSE) | C99 header | 1,592,108 / 1,604,000 as is; **1,604,000** with our 89-line layer | no (our layer adds it) | yes | none | tick + pin mask, `z80_opdone()` | 52 KB (14.4 KB gzip) |
| [redcode/Z80](https://github.com/redcode/Z80) 0.2 (pre) | [LGPL-3.0-or-later](https://github.com/redcode/Z80/blob/master/COPYING.LESSER) | ANSI C | **1,604,000 / 1,604,000** (Zilog NMOS model), Q 0 mismatches | yes (`Z80_WITH_Q`) | yes | Zilog NMOS/CMOS, NEC NMOS, ST CMOS | `z80_execute()`, callbacks | 25 KB (5 KB gzip) |
| [kosarev/z80](https://github.com/kosarev/z80) 1.2.0 | [MIT](https://github.com/kosarev/z80/blob/master/LICENSE) | C++11 header | 1,592,832 / 1,604,000 | no | yes (bugs on INI/IND/OUTI/OTIR) | `common`/`cmos` (OUT (C),0 only) | `on_step()`, handlers | not built |
| [rustzx-z80](https://github.com/rustzx/rustzx/tree/master/rustzx-z80) 0.16.0 | [MIT](https://github.com/rustzx/rustzx/blob/master/LICENSE.md) | Rust | 1,593,416 / 1,604,000 | yes | yes (bugs) | none | `emulate()`, `Z80Bus` trait | not built |
| [gozilog](https://www.npmjs.com/package/gozilog) 1.2.0 | [MIT](https://github.com/mtrisic/gozilog) | Go → wasm on npm | sample of 20,000 cases passes (ports aside); full run crashed in the binding, see [gozilog](#gozilog-go-compiled-to-webassembly-on-npm) | yes | yes | none | `step()`, no port hooks | ships 332 KB `.wasm` |
| [z80emu](https://github.com/royaltm/rust-z80emu) 0.11.0 | **LGPL-3.0-or-later** | Rust | not run | yes | yes | NMOS, CMOS, BM1 | `Cpu` trait | not built |
| [iz80](https://github.com/ivanizag/iz80) 0.5.1 | BSD-3-Clause | Rust | not run: no WZ | no | **no** | none | `execute_instruction()` | — |
| [superzazu/z80](https://github.com/superzazu/z80) | MIT | C | not run: 8-bit ports | ? | yes | none | `z80_step()` | — |
| jsspeccy3 core | **GPL-3.0** | AssemblyScript | excluded by licence | — | — | — | — | — |
| `z80-emulator` 2.3.0 (current) | MIT | TypeScript | fails (the families listed in the brief) | no | yes | none | `step()` | — |

## Verified by running

### Method

Everything ran in the session scratchpad, never in the repo. Each downloaded project sat in its own directory.

- A Python script converted the SST JSON files into a flat text format. A small shared driver (C for the C/C++ cores, Rust for the Rust cores) loaded each case, ran **one step**, and compared the same fields as `src/cpu/single-step-tests.test.ts`. It also tallied Q on its own.
- "One step" means one whole instruction, prefixes included:
  - floooh: tick until `z80_opdone()`.
  - redcode: call `z80_execute(&cpu, 1)` again while `cpu.resume == Z80_RESUME_XY`, because a lone DD/FD prefix stops with that resume code.
  - kosarev: call `on_step()` again while an index prefix is pending.
  - cell80 and rustzx: one call to `step()` / `emulate()`.
- WebAssembly builds used `clang --target=wasm32` (Alpine clang 22.1.3) and `cargo build --target wasm32-unknown-unknown` (Alpine rustc 1.96.1), both inside the stock `alpine` Docker image. Each `.wasm` file exports the same tiny interface:
  - `memory_ptr()` and `regs_ptr()` return a 64 KB memory buffer and a 19-entry register array.
  - `set_state()` and `step()` load the state and run one instruction.
  - `env.io_in` and `env.io_out` are the port imports.
- A Node 24 script then ran the whole SST suite, directly from JSON, against each `.wasm` file.
- Differential fuzzing: a Node script ran redcode, cell80 and floooh + layer side by side on random 64 KB memories and random registers, and compared all registers, Q and port writes after every instruction, and all memory at the end of each run. It stopped a run at HALT, because the PC conventions differ there. Run: 30,000 runs × up to 1,000 steps, which is 18,120,254 instructions.

### SST results per family

Only failing files are listed. Every other file passed 1,000/1,000.

| File | Meaning | floooh as is | kosarev | rustzx | redcode NEC NMOS model | redcode Zilog CMOS model |
|---|---|---|---|---|---|---|
| `37`, `3f` | SCF, CCF (X/Y needs Q) | 229, 219 fail | 229, 219 | pass | 229, 219 | pass |
| `dd/fd 37`, `dd/fd 3f` | prefixed SCF/CCF (prefix zeroes Q) | 454/456, 440/412 | same | 239/223, 230/193 | same as floooh | pass |
| `76`, `dd/fd 76` | HALT: SST expects PC past the HALT | 1,000 each (PC stays on HALT) | pass | 1,000 each | pass | pass |
| `ed b0 b1 b8 b9` | LDIR/CPIR/LDDR/CPDR repeating X/Y | 721–762 each | same | pass | pass | pass |
| `ed b2 b3 ba bb` | INIR/OTIR/INDR/OTDR repeating H/PV/X/Y | 925–937 each | 999–1,000 (F and WZ) | WZ 995–1,000 | pass | pass |
| `ed a2`, `ed aa` | INI, IND | pass | WZ 1,000 each | pass | pass | pass |
| `32`, `dd/fd 32` | LD (nn),A WZ | pass | pass | WZ ~900 each | pass | pass |
| `ed 71` | OUT (C),0 | pass | pass | pass | pass | 1,000 (writes FF: correct for CMOS) |
| **Total failed** | | **11,892** | **11,168** | **10,584** | 2,210 | 1,000 |

- redcode with the Zilog NMOS model, cell80-z80, and floooh + layer: **0 failures out of 1,604,000**, and 0 Q mismatches.
- floooh passes every family where `z80-emulator` fails, except SCF/CCF, HALT and the repeating block flags:
  - non-indexed opcodes after a DD/FD prefix (for example `dd 01`, `dd 3e`, `fd 47`)
  - `ed 57` LD A,I, `ed 5f` LD A,R, `ed 4f` LD R,A
  - `ed 70` IN F,(C), `ed 78`, `ed 71`
  - WZ in repeating block instructions
- The NEC NMOS and Zilog CMOS columns show that the SST suite models the **Zilog NMOS** chip. A core that models another chip fails exactly the cases where the chips differ.

### Fuzzing results

On 18,120,254 random instructions (seed 987654), both cell80-z80 and floooh + layer had **0 divergences** from redcode/Z80 (Zilog NMOS model, Q on).

An earlier fuzz run of 670,515 instructions found two bugs in the first version of our floooh layer, and we fixed them:

- it treated undefined `ED Cx`/`ED Dx` opcodes as block instructions;
- it lost Q after a `DD DD` prefix chain.

So the fuzzing checks behaviour SST does not cover: undefined ED opcodes, prefix chains, and Q carried from one instruction to the next.

### Speed

- Native, full suite, one process: about 5 s each for floooh, redcode and cell80, and 16 s for kosarev.
- Node 24 running the `.wasm` files with JSON parsing included: 8.6 s for floooh, 13.9 s for cell80, 13.3 s for redcode.

Speed will not be a concern for z80-tdd.

## Candidates in detail

### cell80-z80 (Rust)

Documented by the project:

- The [crate](https://crates.io/crates/cell80-z80) describes itself as a "pure, no_std Z80 CPU core", licence `MIT OR Apache-2.0`, version 0.8.0 of 2026-06-30.
- The [crate doc](https://github.com/chrishayuk/cell80/blob/main/z80/src/lib.rs) claims ZEXALL/ZEXDOC-clean, "including MEMPTR/WZ, XF/YF, the SCF/CCF Q-quirk".
- The [z80-tests README](https://github.com/chrishayuk/cell80/blob/main/z80-tests/README.md) reports "SingleStepTests **1 530 000 / 1 530 000**" with cycle counts. It also lists six core bugs that the suite caught, among them the LDIR/CPIR/INIR repeat flags and the DD/FD SCF/CCF Q case.
- The [harness](https://github.com/chrishayuk/cell80/blob/main/z80-tests/tests/single_step.rs) says P (the LD A,I/R interrupt latch) is not modelled. That latch only matters when an interrupt is accepted, which is out of scope for z80-tdd.

Verified by running:

- 1,604,000/1,604,000 natively and as `.wasm`, Q included.
- 0 divergences from redcode in fuzzing.

API:

- [`Cpu`](https://github.com/chrishayuk/cell80/blob/main/z80/src/cpu.rs) has public `regs` (main and shadow bytes, `ix`, `iy`, `sp`, `pc`, `i`, `r`, `wz`), plus `iff1`, `iff2`, `im`, `halted`, `q` and `ei_pending`.
- `step()` runs one whole instruction, DD/FD prefixes included.
- The [`Bus`](https://github.com/chrishayuk/cell80/blob/main/z80/src/bus.rs) trait has `read`, `write`, `input(port: u16)`, `output(port: u16, val)`, and the no-op hooks `contend` and `tick`.

Risks:

- The repository was created on 2026-06-26. The last commit is from 2026-07-17. It has one author and 7 stars. The core lives inside a larger experimental monorepo.
- `ED FE` is reserved as a "host trap" ([decode.rs](https://github.com/chrishayuk/cell80/blob/main/z80/src/decode.rs), around line 443). With the default `Bus::host_trap` it behaves as the NOP it is on real hardware. Our wrapper must keep the default.
- It has no variant support.

WebAssembly:

- `cargo build --release --target wasm32-unknown-unknown` with a 37-line `cdylib` wrapper, `opt-level = "s"` and LTO gives 30,566 bytes.
- On the maintainer's machine it needs `rustup target add wasm32-unknown-unknown` (rustc 1.95 is installed and the crate asks for 1.85). Docker also works.

### floooh/chips `z80.h` (C)

Documented by the project:

- The [README](https://github.com/floooh/chips/blob/master/README.md) describes "dependency-free C headers" whose chips talk through a pin bit mask. The tests live in [chips-test](https://github.com/floooh/chips-test).
- That repo runs [ZEXDOC/ZEXALL](https://github.com/floooh/chips-test/blob/master/tests/z80-zex.c) and the [FUSE tests](https://github.com/floooh/chips-test/blob/master/tests/z80-fuse.c). The FUSE tests ignore X/Y for `BIT n,(HL)` because "FUSE handles those wrong".
- chips-test also includes [raxoft z80test 1.0](https://github.com/floooh/chips-test/tree/master/tests/z80test-1.0).
- The author's [blog post on the cycle-stepped rewrite](https://floooh.github.io/2021/12/17/cycle-stepped-z80.html) names ZEXALL and FUSE. It does not mention Q, SCF/CCF or the block-repeat flags. Nothing mentions SingleStepTests.

From the code at commit [`9e88298`](https://github.com/floooh/chips/tree/9e88298ce56319953ac7a43213a1120359f7a3a6):

- `z80_t` has `wz`, `ir`, the shadow registers, `im`, `iff1` and `iff2`, but no Q ([z80.h lines 336–366](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/chips/z80.h#L336-L366)).
- SCF/CCF take X/Y from A only ([lines 681–687](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/chips/z80.h#L681-L687)).
- HALT does `pc--` ([line 459](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/chips/z80.h#L459)).
- `z80_opdone()` is true one tick into the next instruction's M1, and false while a prefix is active ([line 453](https://github.com/floooh/chips/blob/9e88298ce56319953ac7a43213a1120359f7a3a6/chips/z80.h#L453)). So "tick until opdone" is one whole instruction with its prefixes, or one block-instruction iteration.
- Because of that overlap, the PC we read after a step is `cpu.pc - 1`, as chips-test's FUSE harness also does.
- `z80.h` itself last changed on 2025-01-02. The repo was last pushed on 2026-09-26.

Verified by running:

- 99.26 % as is. All failures are in SCF/CCF (Q), HALT PC, and the F register of repeating block instructions. WZ is right everywhere.
- 100 % with our post-step layer. That layer is C code in the wasm wrapper, and the upstream file is untouched:
  - It keeps Q from a per-opcode "writes F" table. That table was checked against SST's final Q on all 1.6 M cases with 0 mismatches.
  - It rewrites SCF/CCF X/Y as `((Q ^ F) | A) & 0x28`, with Q = 0 after a DD/FD prefix.
  - It applies the David Banks block-repeat formulas, as written in [redcode's Z80.c](https://github.com/redcode/Z80/blob/master/sources/Z80.c) comments.
  - It reports HALT PC as HALT + 1.
- 0 fuzz divergences after the two fixes above.

WebAssembly:

- `clang --target=wasm32 -O2 -nostdlib -ffreestanding`. The header includes `<string.h>` only for `memset`, so we provide a 1-line `memset` and a stub `string.h`.
- The wrapper is 44 lines, or 89 with the layer. The output is 52 KB.
- No clang on the host, so the build runs `apk add clang lld` in the `alpine` image (about 13 s). Emscripten is not needed.

Trade-off: the 89-line layer is our code. It is checked by SST and by fuzzing against redcode, but it is one more thing to maintain. Variant support could live in the same layer: SCF/CCF X/Y for NEC, and OUT (C),0 for CMOS.

### redcode/Z80 (C)

Documented by the project:

- The [README](https://github.com/redcode/Z80/blob/master/README.md) says it "emulates all that is known to date about this CPU, including the undocumented behaviors, MEMPTR, Q and the special RESET".
- It passes raxoft z80test (including `z80ccf`, `z80memptr`), Woodmass's Z80 Test Suite, and zexdoc/zexall.
- It publishes [test logs for Zilog NMOS, Zilog CMOS, NEC NMOS and ST CMOS](https://github.com/redcode/Z80/blob/master/README.md#results).
- A [step-tests workflow](https://github.com/redcode/Z80/blob/master/.github/workflows/step-tests.yml) runs the full SST suite. The last runs succeeded on 2026-04-12 ([run 24313569660](https://github.com/redcode/Z80/actions/runs/24313569660)).
- SingleStepTests' own [validate workflow](https://github.com/SingleStepTests/z80/blob/main/.github/workflows/validate.yml) checks the test files with `libz80`, which is this library, through `run-jsmoo-z80-test`.

API:

- CPU models are option bitmasks ([Z80.h lines 528–547](https://github.com/redcode/Z80/blob/master/API/Z80.h#L528-L547)): Zilog NMOS, Zilog CMOS, NEC NMOS, ST CMOS.
- It reads memory and ports through callbacks; ports get the 16-bit address.
- The `Z80` struct has `memptr`, `q`, `r7`, `iff1/2` and `im`.
- `z80_execute(cpu, cycles)` runs whole instructions, but returns after a lone DD/FD prefix with `resume = Z80_RESUME_XY`. A one-line loop handles that.

Activity: last commit 2026-10-22, last tagged pre-release `v0.2-pre-2025-07-02`.

Verified by running:

- Zilog NMOS: 1,604,000/1,604,000 natively and as `.wasm`, Q included.
- NEC NMOS fails only SCF/CCF. Zilog CMOS fails only `OUT (C),0`. This matches the documented differences between chips.

WebAssembly: `clang --target=wasm32` with `-DZ80_STATIC -DZ80_WITH_Q -DZ80_WITH_EXECUTE` and the [Zeta](https://github.com/redcode/Zeta) headers. Zeta is also LGPL-3.0, but only its type and macro headers are needed. The wrapper is 25 lines and the output is 25 KB.

Licence: the library is [LGPL-3.0-or-later](https://github.com/redcode/Z80/blob/master/README.md#license).

- Shipping it as a separate `.wasm` file inside an MIT npm package is arguably possible. LGPL-3 section 4 requires these steps:
  - provide the library's source or a written offer;
  - let users replace the library with a modified version, which a separate `.wasm` file loaded at run time allows if we document how to rebuild and swap it;
  - give notice of the LGPL and include its text.
- This is workable, but it puts LGPL obligations on every release, and every user's lawyer must read it.
- The README offers a [special licence](https://github.com/redcode/Z80/blob/master/README.md#special-licensing) on request.
- Note that the `step-test-Z80` tool in the same repo is GPL-3.0.
- We must not port its code into our MIT TypeScript, because a port would be a derivative work.

### kosarev/z80 (C++)

Documented by the project:

- The [README](https://github.com/kosarev/z80/blob/master/README.md) says it is MIT and passes `cputest`, `8080pre`, `8080exer`, `8080exm`, `prelim` and `zexall`.
- A [transistor-level symbolic simulator](https://github.com/kosarev/z80/tree/master/tests/z80sim) checks it, comparing WZ among the other state.
- PyPI 1.2.0 came out on 2026-09-04. It is the Python package ADR 0001 mentions.

From the code: `z80_variant` is only `common`/`cmos`, which changes OUT (C),0 ([z80.h line 145](https://github.com/kosarev/z80/blob/master/z80.h#L145)). SCF/CCF use A only, because there is no Q ([around line 3342](https://github.com/kosarev/z80/blob/master/z80.h#L3342)).

Verified by running: 11,168 failures. They are SCF/CCF, the repeating block flags, and WZ on INI/IND/INIR/OTIR/INDR/OTDR. HALT passes.

It would need a fix-up layer like floooh's, plus WZ fixes. It has no advantage over floooh for us.

### rustzx-z80 (Rust)

Documented by the project: the [README](https://github.com/rustzx/rustzx/blob/master/README.md) lists WZ/memptr and Q, and z80test as a reference. Last release 0.16.0 on 2023-03-31, last commit 2024-07-26.

Verified by running:

- 10,584 failures: WZ on `LD (nn),A`, `OUT (n),A` (3 cases), INIR/OTIR/INDR/OTDR, DD/FD SCF/CCF, and HALT PC.
- We also found an API bug: `get_h_alt()`/`get_l_alt()` return H/L, not H'/L' ([registers.rs line 496](https://github.com/rustzx/rustzx/blob/master/rustzx-z80/src/registers.rs#L496)). Our harness worked around it with `exx`.

### gozilog (Go compiled to WebAssembly, on npm)

Documented by the project:

- The [npm README](https://www.npmjs.com/package/gozilog) says it "passes all 1604 SingleStepTests files (~1.6 million cases) with per-T-state cycle-trace assertions" and ZEXDOC/ZEXALL, and has WZ, Q and P.
- The licence is MIT. The [repo](https://github.com/mtrisic/gozilog) was created on 2026-07-06 and has 0 stars.
- The JS binding's "I/O reads return 0xFF, writes are dropped" (`index.d.ts`). The per-T-state bus hooks exist only in the Go library.

Not usable as is: z80-tdd needs port callbacks. Using it would mean forking the binding and rebuilding with the Go toolchain (Docker `golang`). The shipped `.wasm` is 332 KB plus Go's `wasm_exec.js`.

Verified by running:

- A 20-file sample (20,000 cases: `00 37 3f 76 27 32 cb 46`, `dd 01 dd 76 dd cb __ 46`, `ed 4f 57 5f 70 71 a2 b0 b1 b2 b3`) passed every case that does not read a port.
- The full-suite run (one process, about 20 s per 20,000 cases) reported no failure before it **crashed** with `RangeError: Map maximum size exceeded` in Go's `wasm_exec.js` (`boxValue`). The binding keeps a reference for every JS value it touches, so a long test session in one process runs out. This alone rules out the npm package as it is.

### Excluded quickly

- **iz80** ([BSD-3-Clause](https://github.com/ivanizag/iz80/blob/master/LICENSE)) passes ZEXALL ([README](https://github.com/ivanizag/iz80/blob/master/README.md)), but its source has no MEMPTR/WZ at all.
- **superzazu/z80** (MIT) has a port callback with an 8-bit port: `uint8_t (*port_in)(z80*, uint8_t)` in [z80.h line 12](https://github.com/superzazu/z80/blob/master/z80.h#L12). Its last commit is from 2021.
- **z80emu** ([LGPL-3.0-or-later](https://github.com/royaltm/rust-z80emu/blob/master/README.md#licensing)) has NMOS/CMOS/BM1 flavours with Q (`Flavour::flags_modified` / `get_q` in [flavours.rs](https://github.com/royaltm/rust-z80emu/blob/master/src/z80/flavours.rs)) and MEMPTR. It has the same licence problem as redcode and was released on 2024-02-25. Not run.
- **jsspeccy3** is [GPL-3.0](https://github.com/gasman/jsspeccy3/blob/main/COPYING).
- **@dcorp80/z80cpu** ([npm](https://www.npmjs.com/package/@dcorp80/z80cpu), Apache-2.0) is a half-cycle core. Registers are only final at M1 T3 of the next instruction, it has no repository link, and it makes no SST claim.
- **@specy/z80** ([npm](https://www.npmjs.com/package/@specy/z80)) is a fork of `lkesteloot/trs80` that reuses the same `z80-emulator` core.
- **Prior art, for information:**
  - [`z80-testing-library`](https://www.npmjs.com/package/z80-testing-library) (MIT) is a headless Z80 unit-test library built on `z80-emulator`.
  - [`zat`](https://www.npmjs.com/package/zat) (MIT, "Z80 Automated Testing") has its own core that passes the FUSE tests, according to its README.

## Building to WebAssembly with the tools available

- **Toolchain:** the host has gcc 11 but no clang/emcc. These options all ran in this session:
  - **C (floooh, redcode):** `docker run alpine` → `apk add clang lld` → `clang --target=wasm32 -O2 -nostdlib -ffreestanding -Wl,--no-entry`. No libc is needed. Emscripten is not needed either, because the wrapper exports plain functions and imports the two port functions.
  - **Rust (cell80):** `rustup target add wasm32-unknown-unknown` on the host, or `apk add cargo rust-wasm` in `alpine`.
- **Wrapper size:**
  - C: 12–25 lines for redcode, 44 for floooh, 89 for floooh + layer.
  - Rust: 37 lines for cell80.
  - The JS side of the CPU adapter is about 30–60 lines: instantiate, map the register array, route `io_in`/`io_out` to the Port reads and writes of the Run.
- **Size:** 25–53 KB raw, 5–15 KB gzipped. The 64 KB memory lives in the module's linear memory and does not count.
- **CI:** build the `.wasm` file in a GitHub Actions job, commit or attach it as a package file, and run SST against the built file in Node. That run takes 9–14 s for the full suite.

## Baseline: our own TypeScript core

- **Size:**
  - cell80's core is 1,839 lines of Rust (`alu`, `cpu`, `decode`, `flags`, `bus`).
  - floooh's `z80.h` is 2,838 lines, generated from [`z80_desc.yml`](https://github.com/floooh/chips/blob/master/codegen/z80_desc.yml).
  - redcode's `Z80.c` is 2,976 lines.
  - A TypeScript core ported from cell80 (MIT/Apache) or floooh (zlib) would be about 1,500–2,000 lines.
- **Effort:** about 2–4 days. SST gives a per-opcode oracle that runs in about 10 s. The fuzz script above can compare our core with any of the `.wasm` builds after every instruction. Most of the time would go into the flags of DAA, the block instructions, and Q.
- **Benefits:**
  - It keeps ADR 0001 exactly as written: pure JS, no build step, readable stack traces.
  - We own all of it.
- **Risks:**
  - We maintain roughly 2,000 lines.
  - Subtle bugs outside SST (prefix chains, undefined opcodes). The differential fuzz against redcode covers them.
  - Licence: we must port from the permissive cores only. Porting from redcode or z80emu would make the TypeScript core LGPL.
- **Models to follow:**
  - cell80's table-driven X/Y/Z/P/Q decode ([decode.rs](https://github.com/chrishayuk/cell80/blob/main/z80/src/decode.rs)) maps well onto a TypeScript `switch`.
  - redcode's comments document every undocumented flag with references. They are useful as a specification, as long as we do not copy the code.

## Ranked shortlist

| Rank | Option | For | Against |
|---|---|---|---|
| 1 | **cell80-z80 as `.wasm`** | 100 % SST and Q with no changes; 0 fuzz divergences from the reference; permissive licence; smallest wrapper (37 lines); 30 KB | Very young, single author, inside an experimental monorepo; no variants; non-standard `ED FE` hook (inert by default) |
| 2 | **floooh z80.h + our 89-line layer, as `.wasm`** | Mature, widely used, zlib; WZ already right everywhere; our layer is a natural place for CPC variants | The layer is our code and must stay in step with SST; tick/pin API needs a tick loop and the `pc - 1` overlap; Q is emulated outside the core |
| 3 | **Own TypeScript core, ported from cell80 or floooh** | Pure JS (ADR 0001 unchanged); no wasm toolchain; full ownership | 2–4 days of work and about 2,000 lines to maintain |
| (ref.) | redcode/Z80 | The reference implementation; the only one with all the variants | LGPL-3.0: possible for a separate `.wasm` file but a burden on every release; a special licence must be asked for |

## Recommendation

Replace `z80-emulator` with **cell80-z80 compiled to WebAssembly**, behind the existing CPU interface:

- It is the only option that reaches 100 % of SingleStepTests/z80, Q included, with no changes.
- 18 million random instructions found no difference from redcode/Z80, the core the suite itself is validated against.
- Its licence is permissive and its wasm file is 30 KB.

To contain the risk of a young, single-author project:

- vendor a pinned copy of its five source files, with the MIT notice, and build the `.wasm` file in CI;
- keep the SST contract test and the differential fuzz against redcode as maintainer-only CI checks (redcode is only run, never shipped);
- record the change in a new ADR that amends ADR 0001, from "pure JavaScript" to "pure JavaScript or a prebuilt WebAssembly file".

If cell80 proves awkward, floooh's `z80.h` + the 89-line layer is a verified drop-in for the same `.wasm` interface. A TypeScript port stays open later if we want to drop wasm.

If CPC variant fidelity becomes a requirement (NEC NMOS SCF/CCF, CMOS `OUT (C),0`), add it as a small post-step option in our wrapper. redcode's model definitions show what to change.
