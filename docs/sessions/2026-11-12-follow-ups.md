# Session — 2026-11-12 — follow-ups

- **Branche :** `feat/follow-ups` (et `docs/no-npm-for-now`, PR #7)
- **Objet :** merger FantAMS, puis traiter trois questions ouvertes : source absent, EQU négatif, `nops.ts` contre cell80.

## Fait

- PR #6 (FantAMS) mergée ; CI de `main` verte (jobs `gate` et `core`), première compilation de FantAMS en CI.
- PR #7 ouverte, non mergée (`docs/no-npm-for-now`) : pas de npm pour le moment, question retirée du STATUS,
  remarque pnpm 10 (lockfile sans `integrity`) déplacée dans ADR 0009.
- Spec et trois tickets : `.scratch/follow-ups/` (commit `807bec9`), tous `done`.
- Ticket 01, `b0048a8` : `sourceFile()` (`src/assembler/source-file.ts`), appelée par RASM et FantAMS avant leur outil :
  `The source file "<source>" does not exist`. Le repli de FantAMS sur la racine est retiré (ADR 0010).
- Ticket 02, `afc7dde` : RASM lit ses symboles en entiers signés 32 bits (`| 0`) : `minus equ -16` → -16 (ADR 0006).
- Ticket 03, `1b60ab7` : horloge alignée sur 4 T-states à chaque accès au bus et en fin de `step()` (`wasm/src/lib.rs`),
  `Cpu.elapsedNops()`, test `src/nops.cell80.test.ts` dans `pnpm test:core` (un test par fichier de la suite, 9,5 s).
  - Écarts trouvés = écarts connus : 16 `IN r,(C)`/`OUT (C),r` (table 4, horloge 3), `OTIR`/`OTDR` répétés (6 contre 7).
  - 1 653 accords sur 1 671 combinaisons distinctes (instruction, NOPs table, NOPs horloge). La mesure du 2026-10-24
    (3 524 sur 3 560, 36 écarts) comptait sur une autre base, qu'on ne retrouve pas : écart non expliqué.
    Indice seulement : mêmes instructions en écart, et 36 = 2 × 18. Le test ne calcule pas de nombre d'accords.
  - Exception nommée dans `.dependency-cruiser.cjs` et phrase ajoutée à la règle 3 de `CODING_STANDARDS.md`.

## Revue avant PR (même jour, seconde session)

- `mattpocock-skills:code-review` : aucune violation des règles, rien de faux par rapport à la spec.
  - `0794af1` : `sourceFile()` refuse aussi un dossier (`stat().isFile()`), un test par adaptateur.
  - `1ef36a5` : écart avec la mesure du 2026-10-24 déclaré non expliqué (ci-dessus).
- `simplify`, `91d60a7` : liste `SUITE_TESTS` partagée par les deux configs vitest, `Case.name` retiré,
  plus de remise à zéro de la mémoire entre les cas du test cell80, tests de source absent en `it.each`.
  - Écartés : module partagé de lecture de la suite (attendre un troisième lecteur), résolution de commande
    commune à RASM et FantAMS (question ouverte), règle dependency-cruiser générique (attendre un second cas).
- PR #7 mergée par l'utilisateur (le mode auto refuse le merge), `main` mergé dans la branche, PR #8 ouverte.

## Non fait / reste

- Merge de la PR #8 et CI de `main`.

## Décisions

- Pas de publication npm pour le moment : ADR 0009 reste.
- Source absent : contrôle dans le module Assembler, pas dans `loadProgram()` (l'Assembler en mémoire ne lit aucun fichier) → spec `follow-ups`.
- Symbole signé pour tout Assembler → [ADR 0006](../adr/0006-labels-match-whatever-their-case.md).
- Horloge cell80 lue par le seul test ; la table reste la référence → [ADR 0002](../adr/0002-nops-counted-from-our-own-cpc-table.md).
- Le glossaire écarte « T-state » : l'horloge s'expose en NOPs.

## Gate

- `pnpm gate` → vert : typecheck, Biome, dependency-cruiser (36 modules), 2 040 tests, puis 6 tests dans l'exemple.
- `pnpm test:core` → vert : 3 209 tests (1 605 contrat SingleStepTests, 1 604 comparaison `nops.ts`).

## État pour reprendre

- **Prochaine action :** merger la PR #8, vérifier la CI de `main`, puis cadrer l'étape suivante.
- **Arbre :** propre après le commit de ce rapport · `feat/follow-ups` poussée, PR #8 ouverte ; PR #7 mergée.
- **Pièges :**
  - Le mode auto refuse `gh pr merge` : l'utilisateur merge lui-même.
  - `cell80.wasm` est reproductible (`pnpm build:wasm` ne change pas son md5) ; la CI le vérifie.
