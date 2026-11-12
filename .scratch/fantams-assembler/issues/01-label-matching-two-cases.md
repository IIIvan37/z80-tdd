# 01: A label name that matches two labels differing only by case

**What to build:** A Program fails, naming each label, when a test asks for a name that matches several labels of the Assembly whatever their case (`loop` with `Loop` and `loop`). Today the last one wins silently. See the spec, story 9 and the label-case decision.

**Blocked by:** none.

**Status:** done

- [x] `address()`, `range()` and `run()` fail on such a name, and the message names every matching label as the Assembler gave it.
- [x] A name that matches a single label still resolves whatever its case.
- [x] Such labels do not stop `loadProgram()`: only asking for the ambiguous name fails.
- [x] Tested through `loadProgram()` with the in-memory Assembler.
- [x] ADR 0006 states the new consequence; GLOSSARY.md needs no change.
