# 02: Validate the Z80 core with SingleStepTests

**What to build:** The maintainer can trust the Z80 core: the SingleStepTests/z80 suite runs against the CPU adapter in CI, checking registers (including WZ/MEMPTR and the undocumented flag bits), memory and port activity for every opcode. See the spec, story 58, and ADR 0001.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [ ] The SingleStepTests/z80 cases run against the CPU adapter, through the CPU interface only.
- [ ] CI runs the suite; it is fetched or cached so a normal test run stays fast.
- [ ] Every failing case is either fixed in the adapter or listed with the reason it does not matter for z80-tdd (for example, a state the tool never exposes).
- [ ] If the core fails on behaviour that matters, the ticket records the decision (replace the core or write our own) in a new ADR, and the rest of the tool is untouched.
