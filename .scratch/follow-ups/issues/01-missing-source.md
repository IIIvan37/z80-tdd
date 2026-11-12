# 01: One message for a missing source file

**What to build:** The RASM and FantAMS Assemblers fail with `The source file "<source>" does not exist` when the source file is not there, before running their tool, through one function of the Assembler module. See the spec, story 1 and the missing-source decision.

**Blocked by:** none.

**Status:** done

- [x] One function of the Assembler module resolves the source from the project root and fails when it is not there; the message names the source as the configuration wrote it. The in-memory Assembler does not call it.
- [x] A source in a folder that does not exist fails the same way.
- [x] The FantAMS adapter always runs `fantams` in the source file's folder: the fallback to the project root goes.
- [x] Tested by the contract tests of both adapters, on a missing source file and on a source in a missing folder.
- [x] ADR 0010 drops its consequence about the fallback; README needs no change unless it describes the old messages.
