# Session — 2026-10-23 — ticket-01-walking-skeleton

- **Branche :** `feat/01-walking-skeleton`, empilée sur `docs/cadrage` (pas de remote, `main` vide)
- **Objet :** livrer le ticket 01 : lancer une Routine et lire ses registres, avec l'outillage du dépôt.

## Fait

- Outillage : pnpm, TypeScript 6 strict, Vitest 5, Biome 2.6, dependency-cruiser 18.7 (règles de structure sondées), workflow GitHub CI.
- API publique : `loadProgram` → `Program` (`address`, `run`) → résultat figé (`registers`, `flags`) ; `inMemoryAssembler` public.
- Run : état initial déterministe, SP `#C000` par défaut, sentinelle de retour qui exige aussi le retour du SP ; refus d'une pile sur le Program, d'un registre trop large, d'un PC fixé par le test.
- Module CPU sur `z80-emulator` 2.3.0, avec une seule liste de registres (16 bits puis 8 bits).
- 22 tests, tous à l'API publique ; `docs/MODULES.md` créé ; **CPU** ajouté à `GLOSSARY.md`.
- Revue `code-review` (Standards + Spec) : tous les constats corrigés dans le commit `fix: harden run entry and return detection after review`.
- Ticket 01 au statut `done`.

## Non fait / reste

- `simplify` n'a pas tourné (règle globale : avant la PR).
- La CI n'a jamais tourné : pas de remote.
- Tickets 02 à 11.

## Décisions

- `program.label` renommé `program.address` ; `inMemoryAssembler` reste public : [spec](../../.scratch/z80-tdd-v1/spec.md).
- TypeScript 6 au lieu de 7 : dependency-cruiser 18.7 n'analyse aucun module avec TS 7. Biome est limité au code (il réécrivait Markdown et lockfile). Note perso : `~/claude-memory/niveaux/perso/ts-tooling-versions.md`.
- Une Routine est finie quand PC revient à la sentinelle **et** SP à sa valeur d'appel : [docs/MODULES.md](../MODULES.md).

## Gate

- `pnpm gate` → vert : typecheck, Biome (17 fichiers), dependency-cruiser (12 modules, 0 violation), Vitest 22/22.

## État pour reprendre

- **Prochaine action :** créer `feat/02-validate-core` depuis `feat/01-walking-skeleton`, puis `/implement` sur le ticket 02.
- **Arbre :** propre ; `feat/01-walking-skeleton` non fusionnée, `main` sans commit.
- **Pièges :**
  - `z80-emulator` est déprécié sur npm (« No longer published to npm; see https://github.com/lkesteloot/trs80 ») : le ticket 02 tranche entre embarquer la source (MIT) et changer de cœur, par un ADR.
  - `z80-base` : `rCombined` masque avec `0xF7` au lieu de `0x7F` ; l'adaptateur CPU le contourne.
  - Pas encore de limite de NOP : une boucle infinie dans un test bloque Vitest (synchrone, le timeout ne l'interrompt pas).
