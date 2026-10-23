# 03: Memory before and after a Run

**What to build:** A CPC developer can write bytes into memory before a Run, read memory after it, get the list of Memory changes, and assert with Vitest matchers that only a given range changed or that memory did not change at all. See the spec, stories 8, 19, 28–33.

**Blocked by:** 01 (Walking skeleton).

**Status:** done

- [x] A test can write bytes before a Run at a label or an address.
- [x] The Program gives a range from a label and a length.
- [x] The Run result reads memory at a label or an address.
- [x] The Run result gives the list of Memory changes, each with address, old value and new value; a byte written with its original value is not a change.
- [x] A matcher asserts that only a given range changed and, on failure, prints the changes outside it.
- [x] A matcher asserts that memory did not change and, on failure, prints the changes.
- [x] A write overflowing a buffer by one byte fails the "only this range changed" assertion.
