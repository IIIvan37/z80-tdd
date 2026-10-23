# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Le ticket 02 est livré : le cœur Z80 est maintenant cell80-z80 compilé en WebAssembly (ADR 0004), et il passe les 1 604 000 cas de
SingleStepTests/z80 (`pnpm test:core`). Gate `pnpm gate` vert, 22 tests à l'API publique. Les modules sont décrits dans
[docs/MODULES.md](MODULES.md), les règles dans [CODING_STANDARDS.md](../CODING_STANDARDS.md), la spec dans
[.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Lancer `/implement` sur le ticket 04 (compter les NOPs des instructions sans préfixe), sur une branche qui part du ticket 02.

## Questions ouvertes

- Quand créer le dépôt privé `IIIvan37/z80-tdd` et fusionner les branches empilées dans `main` par PR ? La CI n'a jamais tourné.

## Tickets

- Livrés : 01, 02.
- Démarrables : 03, 04, 09.
- Prochain : 04 (il débloque 05, 06 et 08).

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **ticket 01** : outillage, API publique, Run avec sentinelle, module CPU sur `z80-emulator`, revue corrigée.
- 2026-10-23 · **ticket 02** : SingleStepTests en test de contrat, recherche de cœurs, passage à cell80-z80 en WebAssembly (ADR 0004).
