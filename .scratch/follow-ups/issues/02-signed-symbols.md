# 02: A negative EQU gives its negative value with RASM too

**What to build:** The RASM adapter reads its symbol export as signed 32-bit numbers, so `minus equ -16` gives -16, as with FantAMS. See the spec, story 2 and the signed-symbols decision.

**Blocked by:** none.

**Status:** ready-for-agent

- [ ] `#FFFFFFF0` in RASM's symbol export gives -16; `#12345` stays #12345.
- [ ] A RASM contract test assembles a fixture with a negative EQU and a label, and checks both values.
- [ ] ADR 0006 states that a symbol's value is signed, for every Assembler.
