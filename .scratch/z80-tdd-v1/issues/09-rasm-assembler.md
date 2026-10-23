# 09: The RASM Assembler

**What to build:** A CPC developer can load a Program from a real source file, assembled by RASM, with its bytes at the addresses RASM gave them and its symbols. Assembly errors and a missing `rasm` produce clear failures. See the spec, stories 4–5, 9–12, and the RASM notes.

**Blocked by:** 01 (Walking skeleton).

**Status:** ready-for-agent

- [ ] The RASM adapter implements the Assembler interface; nothing outside it knows about RASM.
- [ ] It runs `rasm` found on the PATH, or at a path given to it.
- [ ] It returns the assembled bytes with their load addresses and the symbol table read from RASM's symbol export, checked against the installed RASM version (the local docs describe v3.2; RASM is at v3.3.1).
- [ ] An assembly error fails the test with RASM's message, file and line.
- [ ] A missing `rasm` fails with a message saying where to download it.
- [ ] Contract tests assemble small `.asm` fixtures (one routine, several `ORG` blocks, an `INCLUDE`, an error) with the real `rasm`; CI installs RASM to run them.
- [ ] A Program is assembled once per test file, not once per test.
