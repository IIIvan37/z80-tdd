# The folder tree follows the module seams

The skills we build with design deep modules but say nothing about where files go, so code left to them ends up deep in its modules and flat on disk, and the tree no longer shows which decision lives where. We make the tree mirror the seams instead: a module is a file until it gains an internal seam, then a folder whose `index.ts` is its interface, with tests importing only that interface and names taken from `GLOSSARY.md`. We rejected creating folders up front, and the `hexagonal-tdd-starter` layout, because both add structure for variation that does not exist yet.

## Consequences

dependency-cruiser fails the build on any import into another module's folder other than its `index.ts`, and on any test that imports past its module's interface. `docs/MODULES.md` lists each module, its path and the decision it hides.
