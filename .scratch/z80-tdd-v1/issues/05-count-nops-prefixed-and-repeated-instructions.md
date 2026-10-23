# 05: Count NOPs for prefixed and repeated instructions

**What to build:** A CPC developer gets correct NOP counts for every Z80 instruction: the CB, ED, DD, FD, DDCB and FDCB prefixed opcodes, and the repeated block instructions (`LDIR`, `LDDR`, `CPIR`, `CPDR`, `INIR`, `INDR`, `OTIR`, `OTDR`) counted per iteration. See the spec, stories 37–39, and the notes on Madram's source.

**Blocked by:** 04 (Count NOPs for unprefixed instructions).

**Status:** done

- [x] Every opcode of the CB, ED, DD, FD, DDCB and FDCB tables has a NOP count, including undocumented ones the core executes.
- [x] An IX/IY prefix on an instruction without indirection adds 1 NOP; `OUT (C),r` uses its own value.
- [x] Repeated block instructions cost their repeating value per iteration and their final value on the last one.
- [x] Tests compare each count to Madram's value; values Madram gives as free text are covered by explicit tests.
- [x] `ld (ix+n),n` and `ld (iy+n),n`, missing from the local copy of Madram's tables, have a count with its source stated in a test.
- [x] No opcode the core executes fails the Run for lack of a NOP count.
