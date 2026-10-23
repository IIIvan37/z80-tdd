# 06: NOP limit and failure report

**What to build:** A Run that goes on too long stops at its NOP limit and fails the test, and every failed Run shows where it went: the last 16 instructions executed, disassembled, each with its address and nearest label, plus the final registers. See the spec, stories 24–26 and 50–52.

**Blocked by:** 04 (Count NOPs for unprefixed instructions).

**Status:** ready-for-agent

- [ ] The default NOP limit is 1,000,000 NOPs; a test can set another limit for one Run.
- [ ] A Run exceeding its limit stops and fails with a message that says the limit was reached and gives the limit.
- [ ] A failure report shows the last 16 instructions executed, disassembled, each with its address and the nearest label at or below it.
- [ ] A failure report shows the final registers.
- [ ] Every kind of Run failure that exists at this point, including an opcode without a NOP count, carries the failure report.
- [ ] A Routine with an infinite loop fails quickly enough not to slow the test suite noticeably.
- [ ] A Routine stuck on `HALT` counts 1 NOP per step until the limit, and its `HALT` is tested at the public API (ticket 04 could not: the Run never ended). cell80 leaves PC past the `HALT` while halted, so the Run must not look up the byte at PC then.
