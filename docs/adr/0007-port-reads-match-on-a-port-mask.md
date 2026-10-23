# Port reads match on a port mask, #FF00 by default

A Port read looks up what the test supplied under its port address ANDed with the **Port mask**, `#FF00` by default: `ports: { 0xf500: [0, 0, 1] }` answers every read from `#F500` to `#F5FF`. The CPC decodes its ports on bits of the high byte (the PPI on A11, the CRTC on A14), and a CPC Routine reads with `IN A,(C)` after setting B alone, so C holds whatever it held. Matching the full 16-bit address, as the spec first said, would make a test set C to a value the Routine never chose. A fixed choice between "CPC" and "exact" was the other option; a mask stays a general mechanism with a CPC default, and `#FFFF` covers the FDC, whose two ports `#FB7E` and `#FB7F` differ in the low byte.

## Consequences

- The Port mask is a setting of the configuration file, overridable by a test file and by a Run.
- A port the test supplies with bits outside the mask fails the Run before the first step, since no Port read would match it.
- Every address under one key shares its sequence: `INIR` decrements B on each iteration, so its reads move from `#F5xx` to `#F4xx` and change key.
- Port writes are not decoded: each keeps its full 16-bit address.
- A test keys its ports in hexadecimal, as `0xf500`, so `biome.json` turns off Biome's `useSimpleNumberKeys` in test files, where it would have them in decimal.
