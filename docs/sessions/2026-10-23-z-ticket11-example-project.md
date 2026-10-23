# Session — 2026-10-23 — z-ticket11-example-project

- **Branche :** `feat/ticket-11-example-project`, partie de `main` après la fusion de la PR #5 ; pas encore poussée
- **Objet :** ticket 11 : un projet CPC d'exemple testé avec z80-tdd, ses tests en CI, le README d'installation et la licence.

## Fait

- PR #5 (ticket 08, Stubs) ouverte puis fusionnée par l'utilisateur.
- `example/` : paquet du workspace pnpm (`pnpm-workspace.yaml`) qui dépend de `"z80-tdd": "workspace:*"` et lit `dist/` comme un utilisateur.
- Six Routines RASM incluses par `example/src/main.asm`, chacune avec son test : `clear_buffer` (registres, Memory changes, NOPs),
  `wait_vsync` (Port reads), `set_border` (Port writes), `print_string` (Stub à `#BB5A`), `next_frame` (Stub au label `wait_vsync`),
  `clear_buffer_buggy` (rapport d'échec en snapshot inline, cité par le README).
- Script `pnpm example` (build, `tsc -p example`, Vitest de l'exemple), ajouté à la fin de `pnpm gate` ; la CI le lance donc au merge.
- Défaut trouvé en route : `pnpm build` échouait sur `main` (TS2664 dans `src/matchers.ts`), jamais lancé par le gate. Corrigé par
  `import type {} from "vitest"` ; vitest devient `peerDependency`.
- `LICENSE` MIT (Copyright 2026 Ivan Duchauffour). README : extraits réels de l'exemple, étapes d'installation 3 et 4, section « The example project ».
- Ticket 11 `done`. Revue `mattpocock-skills:code-review` (0 violation dure, 6 constats Standards, 1 Spec) puis `simplify` (5 appliqués).

## Non fait / reste

- Pousser la branche et ouvrir sa PR vers `main`.
- Revue de fin de jalon v1 (`mattpocock-skills:code-review` + `security-review` sur tout le diff de la v1), après le merge.

## Décisions

- Exemple en paquet du workspace sur le paquet bâti, cas d'échec en snapshot inline, `LICENSE` ajouté, exemple dans `pnpm gate` :
  choix de l'utilisateur avant le premier test.
- Écarté à la revue : `TXT_OUTPUT` reste une adresse dans `print.test.ts`, pour montrer un Stub à une adresse.
- Écartés de `simplify` : adresses du rapport d'échec recopiées dans le README (copie voulue), `tsc -b` incrémental (gain d'environ 1 s),
  projets Vitest (testerait `src/` au lieu du paquet bâti), cache de `loadProgram()` (moins de 50 ms).
- Reporté : tester le paquet tel que publié (`pnpm pack` ou `injected: true`) ; `workspace:*` ignore `files` et les peer dependencies.

## Gate

- `pnpm gate` → vert : typecheck, Biome (42 fichiers), dependency-cruiser (29 modules, 0 violation), Vitest 2 002/2 002,
  puis `pnpm example` : build, typecheck de l'exemple, Vitest 6/6 avec RASM réel.

## État pour reprendre

- **Prochaine action :** demander à l'utilisateur s'il faut pousser `feat/ticket-11-example-project` et ouvrir sa PR (compte IIIvan37).
- **Arbre :** propre après le commit de ce rapport · branche non poussée, non fusionnée.
- **Pièges :**
  - `gh` a un autre compte comme compte actif : passer `GH_TOKEN=$(gh auth token --user IIIvan37)` à chaque commande `gh`.
  - Un snapshot inline vide s'écrit au premier passage, même avec la mauvaise erreur : relire `failure-report.test.ts` après un changement d'adresse.
  - Une fois la PR ouverte, réécrire le STATUS avec son numéro.
