# NOPs counted from our own CPC table

The tool counts the duration of a Run in CPC NOPs by looking up each executed instruction in its own table, derived from Madram's "Perfectly accurate Z80 flags and CPC timing" (credit Madram / Overlanders), rather than converting the T-states the Z80 core reports. Converting would need a core that reports every machine cycle separately, because a NOP count is the sum of each machine cycle rounded up to 4 T-states, with exceptions such as `OUT (C),r` and IX/IY prefixes; a per-instruction T-state total cannot give it (`RST` is 11 T-states but 4 NOPs). Owning the table keeps the core replaceable and makes the timing checkable against Madram's tables on its own.

## Consequences

- A test of `pnpm test:core` (`src/nops.cell80.test.ts`) compares the table with cell80's clock on every case of SingleStepTests/z80. The clock aligns on 4 T-states at each bus access and at the end of each instruction, and gives `Cpu.elapsedNops()`; only that test reads it. The test lists where the two differ, which is where the rule misses the CPC: `IN r,(C)` and `OUT (C),r`, and `OTIR` and `OTDR` when they repeat. Any other difference fails it.
