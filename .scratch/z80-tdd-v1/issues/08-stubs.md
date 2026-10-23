# 08: Stubs

**What to build:** A CPC developer can declare Stubs at labels or addresses so a Routine under test does not run code that is not under test (another routine, or the firmware whose ROM is not loaded). A Stub returns at once with chosen registers, records each call, and costs a set number of NOPs. See the spec, "Stubs".

**Blocked by:** 04 (Count NOPs for unprefixed instructions).

**Status:** ready-for-agent

- [ ] A test can declare a Stub at a label or at an address for one Run.
- [ ] When PC reaches a Stub, the Run returns to the caller as a `RET` would.
- [ ] A Stub can set chosen registers before returning.
- [ ] The Run result lists every Stub call with the registers at the moment of the call, so a test can check that `play_sound` was called once with `A=3`.
- [ ] A Stub call costs 3 NOPs by default, on top of the `CALL` the Routine paid; a test can give a Stub another duration.
- [ ] A Routine calling a firmware address declared as a Stub (for example `#BB5A`) completes instead of running zeros.
