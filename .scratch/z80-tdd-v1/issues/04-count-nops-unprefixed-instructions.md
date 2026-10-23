# 04: Count NOPs for unprefixed instructions

**What to build:** A CPC developer can read the duration of a Run in CPC NOPs, from the Routine's first instruction to its final `RET` included, and also the duration including the `CALL`, for Routines made of unprefixed instructions. The count comes from the tool's own CPC table, derived from Madram's tables, not from the core. See the spec, "Measuring time", and ADR 0002.

**Blocked by:** 01 (Walking skeleton).

**Status:** done

- [x] The Run result gives the duration in NOPs without the `CALL`, and with it (5 NOPs more).
- [x] Every unprefixed opcode has a NOP count; conditional instructions (`JR cc`, `JP cc`, `CALL cc`, `RET cc`, `DJNZ`) have one count for each outcome.
- [x] A test per instruction (or per instruction pattern) injects its bytes, runs it, and compares the count to Madram's value.
- [x] `RST` counts 4 NOPs, not the 11 T-states rounded.
- [x] The package credits Madram / Overlanders for the timing data, as the source asks.
- [x] Executing a prefixed opcode whose count is not in the table yet fails the Run with a clear message, rather than counting zero.
