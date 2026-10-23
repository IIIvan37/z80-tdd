# cell80-z80, vendored

The Z80 core z80-tdd runs, copied without change from [chrishayuk/cell80](https://github.com/chrishayuk/cell80) at commit [`f7ff045`](https://github.com/chrishayuk/cell80/tree/f7ff045ac7770bd7ad63e1910600284a4ea0dfed/z80) (folder `z80/`, crate version 0.8.0). Licence: MIT or Apache-2.0, see `LICENSE-MIT` and `LICENSE-APACHE`. Why this core: [ADR 0004](../../../docs/adr/0004-cell80-z80-core-as-webassembly.md).

Only `Cargo.toml` is ours: the upstream one inherits its fields from the cell80 workspace.

To update: copy `z80/src/` from a newer commit, change the commit above, run `pnpm build:wasm`, then `pnpm test:core`.
