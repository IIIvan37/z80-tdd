# 07: Ports

**What to build:** A CPC developer can check every Port write a Routine made, and supply what each Port read returns, either as a sequence of values or as a function. A read the test did not supply fails the Run instead of inventing a value. See the spec, "Ports".

**Blocked by:** 06 (NOP limit and failure report).

**Status:** done

- [x] Every `OUT` instruction, including `OUT (n),A`, `OUT (C),r` and the block outputs, adds a Port write with its full 16-bit port address and its value, in order.
- [x] A test can give, per port, a sequence of values that `IN` returns in order.
- [x] A test can give, per port, a function that computes the value read.
- [x] A read from a port the test did not supply fails the Run, naming the port address and the PC, with the failure report.
- [x] A read past the end of a port's sequence fails the Run the same way.
- [x] A Routine that polls a port until bit 0 is set (as when waiting for VSYNC) passes when the test supplies the right sequence.
