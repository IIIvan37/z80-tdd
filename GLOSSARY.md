# z80-tdd

A tool for writing Z80 assembly test-first: each test runs a piece of Z80 code from a real Amstrad CPC project and checks the machine state it leaves behind.

## Language

**Routine**:
The piece of Z80 assembly code a test exercises, entered at a label and finished when control returns to the address the test called it from.
_Avoid_: Function, subroutine, procedure

**Run**:
One execution of a **Routine** inside the tool, from its entry label until it returns or exceeds its time limit.
_Avoid_: Call, execution, invocation

**Assembler**:
The external program that turns the CPC project's source into machine code and a symbol table; RASM is the first one supported.
_Avoid_: Compiler, toolchain

**Configuration file**:
The typed `z80-tdd.config.ts` at the root of the CPC project, holding the **Assembler**, the default source file, the default SP and the default **NOP limit**; a test file or a **Run** can override each.
_Avoid_: Settings file, config

**CPU**:
The emulated Z80 processor that executes a **Run**, with its registers and flags.
_Avoid_: Processor

**Program**:
The machine code and symbol table the **Assembler** produces from one source file of the CPC project, loaded at its real addresses before each **Run**.
_Avoid_: Build, binary, image

**Memory change**:
One byte whose value after a **Run** differs from its value before, given by address, old value and new value.
_Avoid_: Diff, side effect

**Matcher**:
A Vitest assertion on a **Run** that the tool adds to `expect`, such as "only this range changed", whose failure message shows the state at fault.
_Avoid_: Assertion helper, checker

**NOP**:
The CPC unit of time, one microsecond, in which the duration of a **Run** is counted; the Z80 instruction of the same name is only ever written as code, `NOP`.
_Avoid_: Cycle, T-state, tick

**NOP limit**:
The longest a **Run** may last before the tool stops it and fails the test.
_Avoid_: Cycle budget, timeout

**Stub**:
A label or address the test declares so that a **Routine** calling it returns at once, with outputs the test chooses, and each call is recorded.
_Avoid_: Mock, fake

**Port write**:
A value the **Routine** sends to an I/O port with `OUT`, recorded so a test can check it.

**Port read**:
A value the **Routine** receives from an I/O port with `IN`, supplied by the test.
