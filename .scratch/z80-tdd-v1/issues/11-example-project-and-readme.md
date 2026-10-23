# 11: Example project and README

**What to build:** A CPC developer discovering z80-tdd can install it and write a first test by following the README, and can read a small example CPC project in the repository whose tests exercise every feature end to end with the real RASM and a configuration file.

**Blocked by:** 03 (Memory before and after a Run), 05 (Count NOPs for prefixed and repeated instructions), 07 (Ports), 08 (Stubs), 10 (The configuration file).

**Status:** done

- [x] The example project has a configuration file, a few Routines in RASM syntax and tests covering registers, Memory changes, NOPs, Port writes, Port reads, Stubs and a deliberately failing case shown in the README.
- [x] CI runs the example project's tests.
- [x] The README explains installation as a dev dependency, installing RASM, the configuration file and a first test, using the vocabulary of `GLOSSARY.md`.
- [x] The README credits Madram / Overlanders for the timing data and states the MIT licence.
