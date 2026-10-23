# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Les tickets 01 à 10 sont dans `main` du dépôt privé `IIIvan37/z80-tdd`, livrés par la PR #1 avec un passage de `simplify` et un README.
La CI GitHub tourne `pnpm gate` et le job `core` (cell80.wasm recompilé et comparé, SingleStepTests) : verte à sa première exécution.
Gate local vert, 1 961 tests. Le cœur Z80 reste cell80-z80 en WebAssembly (ADR 0004).
Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Ticket 07 (Ports), sur une branche partie de `main`.

## Questions ouvertes

- Compter les NOPs d'une instruction conditionnelle d'après les T-states que cell80 calcule déjà (`tick()` les jette dans `wasm/src/lib.rs`),
  au lieu du choix refait en TypeScript dans `nops.ts` ? Touche l'ADR 0002 ; ouvrirait un appel WASM par pas et `nopsOf` sans `undefined`.
- Ajouter un fichier `LICENSE` (MIT) ? README et `package.json` l'annoncent, le fichier manque. (proposé, sans réponse)
- Un label inconnu doit-il porter le rapport d'échec ? Aujourd'hui non (il échoue avant le premier pas) ; à trancher avec les Stubs (ticket 08).

## Tickets

- Livrés : 01, 02, 03, 04, 05, 06, 09, 10.
- Démarrables : 07, 08 ; le README du ticket 11 existe déjà, le reste du 11 attend 07 et 08.
- Prochain : 07.

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
