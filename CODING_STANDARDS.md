# Coding standards

## Module structure

The folder tree follows the module seams. Why: [ADR 0003](docs/adr/0003-folder-tree-follows-module-seams.md). Where each module lives and what it hides: [docs/MODULES.md](docs/MODULES.md).

1. **A module starts as a file.** It becomes a folder only when part of its implementation deserves to be tested or replaced on its own, that is, when it gains an internal seam.
2. **A folder's `index.ts` is its interface.** Anything it does not export is private to the folder, even though TypeScript would allow the import.
3. **Tests sit next to the interface they test and import only that interface**: the module's file, or its folder's `index.ts`. A test that imports anything else is testing past the interface.
4. **Module names come from [GLOSSARY.md](GLOSSARY.md).** No `utils/`, `helpers/`, `common/` or `lib/`.

dependency-cruiser enforces rules 2 and 3; the review judges rules 1 and 4.
