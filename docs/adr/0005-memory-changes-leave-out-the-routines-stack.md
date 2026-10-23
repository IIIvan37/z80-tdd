# Memory changes leave out the Routine's stack

The Memory changes of a Run leave out the bytes of the stack the Routine used, because the `CALL` and `PUSH` of almost every Routine write there, and "memory did not change" would otherwise fail for a Routine that only reads. That stack starts at the caller's SP and grows down at most 2 bytes at a time (`PUSH`, `CALL`, `RST`, `DEC SP`), so a Routine that moves SP with `ld sp,nn` to fill a buffer with `PUSH`, a common CPC trick, still sees those writes as Memory changes; taking every byte from the lowest SP reached up to the caller's SP would have hidden them.

## Consequences

- A local frame made by moving SP more than 2 bytes at once (`ld sp,ix`, `ld sp,hl`) is not part of the stack: its writes are Memory changes.
- A stray write that lands inside the Routine's stack is not seen.
