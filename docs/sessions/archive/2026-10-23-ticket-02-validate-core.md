# Session — 2026-10-23 — ticket-02-validate-core

- **Branche :** `feat/02-validate-core`, empilée sur `feat/01-walking-skeleton` (pas de remote, `main` vide)
- **Objet :** livrer le ticket 02 : valider le cœur Z80 contre SingleStepTests/z80.

## Fait

- Test de contrat `src/cpu/single-step-tests.test.ts` : 1 604 fichiers, 1 604 000 cas, à l'interface du module CPU seule. Il compare registres et drapeaux (bits 3 et 5 compris), WZ, IFF1, IFF2, IM, Q, la RAM listée, l'absence d'écriture ailleurs, et les ports.
- `z80-emulator` échouait sur 334 fichiers (préfixe DD/FD devant une instruction sans IX/IY, `LD A,R`, `LD R,A`, `IN F,(C)`, `SCF`/`CCF`, `HALT`, blocs répétés).
- Recherche de cœurs : `docs/research/z80-core-candidates.md` (cell80, chips `z80.h`, redcode et d'autres, tous passés contre la suite par un agent).
- Cœur remplacé par cell80-z80 compilé en WebAssembly : source embarquée dans `wasm/vendor/cell80-z80/` (commit `f7ff045`), enveloppe `wasm/src/lib.rs`, fichier `src/cpu/cell80.wasm` versionné (18,7 Ko, reconstruction identique), adaptateur `src/cpu/cell80.ts`.
- Interface `Cpu` : `memory` (le CPU possède ses 64 Ko), `internals()`/`setInternals()` (WZ, IFF1, IFF2, IM, Q, HALT), `createCpu(ports?)`. `run.ts` copie le Program dans `cpu.memory` (3 lignes).
- Scripts : `pnpm test:core` (télécharge la suite épinglée `ebe1875` dans `.cache/`, environ 50 s), `pnpm build:wasm`, `pnpm build` copie le `.wasm` et sa licence MIT dans `dist/cpu/`. Paquet construit testé : il lance une Routine.
- CI : job `core` qui installe la chaîne Rust épinglée, reconstruit le `.wasm`, échoue s'il diffère, met la suite en cache et la lance.
- Revue `code-review` (Standards + Spec) : tous les constats corrigés avant le commit `3e4690f`.

## Non fait / reste

- La CI n'a jamais tourné : pas de remote. La case « CI runs the suite » du ticket 02 attend le premier passage vert.
- `simplify` n'a pas tourné (règle globale : avant la PR).
- Tickets 03 à 11.

## Décisions

- Cœur Z80 : cell80-z80 en WebAssembly ; repli vérifié : chips `z80.h` plus une couche de 89 lignes : [ADR 0004](../adr/0004-cell80-z80-core-as-webassembly.md), qui amende l'ADR 0001.
- La suite n'est pas versionnée (1,3 Go) : téléchargée par `scripts/fetch-single-step-tests.ts`, hors de `pnpm test` : [ticket 02](../../.scratch/z80-tdd-v1/issues/02-validate-core-with-singlesteptests.md).
- `spec.md` renvoie à l'ADR 0004 dans « Z80 core ».

## Gate

- `pnpm gate` → vert : typecheck, Biome (22 fichiers), dependency-cruiser (14 modules, 0 violation), Vitest 22/22.
- `pnpm test:core` → vert : 1 605/1 605 (1 604 fichiers + présence de la suite), 59 s.

## État pour reprendre

- **Prochaine action :** créer `feat/04-count-nops-unprefixed` depuis `feat/02-validate-core`, puis `/implement` sur le ticket 04.
- **Arbre :** propre après le commit de ce rapport ; `feat/02-validate-core` non fusionnée, `main` sans commit.
- **Pièges :**
  - Toujours pas de NOP limit : une boucle infinie ou un `HALT` dans une Routine bloque Vitest (le CPU reste « halted » et répète des `NOP`).
  - `fetch` de Node ignore le proxy de l'environnement : le script passe `--use-env-proxy`.
  - rustup cherche `rust-toolchain.toml` depuis le dossier courant : cargo doit tourner dans `wasm/` (`scripts/build-wasm.ts` le fait).
  - cell80-z80 embarque un désassembleur (`wasm/vendor/cell80-z80/src/disasm.rs`), utile pour le rapport d'échec du ticket 06.
  - `.cache/` (1,3 Go) et le scratchpad de la session (environ 1,3 Go de builds de l'agent) occupent le disque ; rien n'en dépend dans le dépôt.
