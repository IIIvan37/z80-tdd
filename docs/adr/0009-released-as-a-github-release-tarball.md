# Released as a GitHub release tarball, not on npm

A CPC project installs z80-tdd from the tarball attached to a GitHub release: `pnpm add -D https://github.com/IIIvan37/z80-tdd/releases/download/v0.1.0/z80-tdd-0.1.0.tgz`. The tarball is what `pnpm pack` makes after `pnpm build`, so it is the same file a later `npm publish` would send. npm is premature for a first release whose first readers are the sorting-algorithm repository and its blog posts. A git dependency (`github:IIIvan37/z80-tdd#v0.1.0`) was the other option: it would build z80-tdd on the reader's machine, which needs a `prepare` script and the dev dependencies there.

## Consequences

- `package.json` keeps `"private": true`, which blocks an accidental `npm publish` but not `pnpm pack`.
- A release is made from `main`: `pnpm build`, then `pnpm pack`, then `gh release create vX.Y.Z` with the tarball. `pnpm pack` packs `dist/` as it is, so a stale `dist/` would ship.
- The README's install step names one exact version; each release updates it.
- The GitHub repository is public, so that the release URL works without authentication.
