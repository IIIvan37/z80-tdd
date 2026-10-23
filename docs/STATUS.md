# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Le ticket 01 (walking skeleton) est livré : un test charge un Program depuis l'Assembler en mémoire, lance un Run par label et lit
les registres et les drapeaux. Gate `pnpm gate` vert, 22 tests à l'API publique. Les modules sont décrits dans
[docs/MODULES.md](MODULES.md), les règles dans [CODING_STANDARDS.md](../CODING_STANDARDS.md), la spec dans
[.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Lancer `/implement` sur le ticket 02 (valider le cœur Z80 avec SingleStepTests), sur une branche qui part du ticket 01.

## Questions ouvertes

- Le cœur `z80-emulator` n'est plus publié sur npm : embarquer sa source (MIT) ou changer de cœur ? Le ticket 02 tranche, par un ADR.
- Quand créer le dépôt privé `IIIvan37/z80-tdd` et fusionner les branches empilées dans `main` par PR ?

## Tickets

- Livrés : 01.
- Démarrables : 02, 03, 04, 09.
- Prochain : 02.

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **ticket 01** : outillage, API publique, Run avec sentinelle, module CPU sur `z80-emulator`, revue corrigée.
