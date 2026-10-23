# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Les tickets 01 à 06, 09 et 10 sont dans `main` du dépôt privé `IIIvan37/z80-tdd` (PR #1). Le ticket 07 (Ports) est fini
sur la branche `feat/ticket-07-ports`, revue et `simplify` faits, pas encore poussée : Port writes, Port reads fournies
par séquence ou par fonction, Port mask `#FF00` par défaut (ADR 0007).
La CI GitHub ne tourne qu'au merge dans `main`, hors Markdown seul ; avant une PR, `pnpm gate` local est le seul contrôle.
Gate local vert, 1 986 tests. Le cœur Z80 reste cell80-z80 en WebAssembly (ADR 0004).
Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Pousser `feat/ticket-07-ports` et ouvrir sa PR vers `main`, après accord de l'utilisateur (compte IIIvan37).

## Questions ouvertes

- Compter les NOPs d'une instruction conditionnelle d'après les T-states que cell80 calcule déjà (`tick()` les jette dans `wasm/src/lib.rs`),
  au lieu du choix refait en TypeScript dans `nops.ts` ? Touche l'ADR 0002 ; ouvrirait un appel WASM par pas et `nopsOf` sans `undefined`.
- Ajouter un fichier `LICENSE` (MIT) ? README et `package.json` l'annoncent, le fichier manque. (proposé, sans réponse)
- Un label inconnu doit-il porter le rapport d'échec ? Aujourd'hui non (il échoue avant le premier pas) ; à trancher avec les Stubs (ticket 08).

## Tickets

- Livrés : 01, 02, 03, 04, 05, 06, 07, 09, 10 (07 sur sa branche, PR à ouvrir).
- Démarrables : 08 ; le README du ticket 11 existe déjà, le reste du 11 attend 08.
- Prochain : 08 (Stubs), une fois la PR du 07 fusionnée.

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **ticket 01** : outillage, API publique, Run avec sentinelle, module CPU sur `z80-emulator`, revue corrigée.
- 2026-10-23 · **ticket 02** : SingleStepTests en test de contrat, recherche de cœurs, passage à cell80-z80 en WebAssembly (ADR 0004).
- 2026-10-23 · **ticket 04** : durée en NOPs des instructions sans préfixe, table de Madram, crédit dans `CREDITS.md`.
- 2026-10-23 · **ticket 06** : NOP limit, rapport d'échec avec désassembleur de cell80, `HALT` compté, `registers()` 40 fois plus rapide.
- 2026-10-23 · **ticket 05** : NOPs des instructions préfixées et répétées, chaînes de préfixes, `ld (ix+n),n` calculé par la règle de Madram.
- 2026-10-23 · **ticket 03** : mémoire avant et après un Run, Memory changes sans la pile (ADR 0005), Matchers, revue corrigée.
- 2026-10-23 · **ticket 09** : Assembler RASM (fichier englobant, listing `-map`), labels sans casse (ADR 0006), RASM v3.3.1 en CI, revue corrigée.
- 2026-10-23 · **ticket 10** : fichier de configuration, réglages contrôlés par une table, chemin relatif de `rasm` corrigé, revue corrigée.
- 2026-10-23 · **première PR** : dépôt distant, `simplify` sur tout le code (*ring buffer*, `isWholeIn`), README, CI verte, PR #1.
- 2026-10-23 · **CI au merge** : CI au seul merge dans `main`, sans les changements Markdown, PR #3.
- 2026-10-23 · **ticket 07** : Port writes, Port reads par séquence ou fonction, Port mask `#FF00` (ADR 0007), revue et `simplify` faits.
