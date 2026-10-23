# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Le ticket 04 est livré : un Run donne sa durée en NOPs (`nops`, et `nopsWithCall` avec le `CALL`) pour toute instruction sans préfixe,
d'après la table de Madram dans `src/nops.ts` (ADR 0002). Un opcode préfixé fait échouer le Run. Gate `pnpm gate` vert, 302 tests à
l'API publique. Le cœur Z80 reste cell80-z80 en WebAssembly (ADR 0004), validé par `pnpm test:core`. Modules :
[docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md), spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Lancer `/implement` sur le ticket 06 (NOP limit et rapport d'échec), sur une branche qui part du ticket 04.

## Questions ouvertes

- Quand créer le dépôt privé `IIIvan37/z80-tdd` et fusionner les branches empilées dans `main` par PR ? La CI n'a jamais tourné.

## Tickets

- Livrés : 01, 02, 04.
- Démarrables : 03, 05, 06, 08, 09.
- Prochain : 06 (il débloque 07 et 10, et met fin aux Runs qui bloquent Vitest sur une boucle ou un `HALT`).

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **ticket 01** : outillage, API publique, Run avec sentinelle, module CPU sur `z80-emulator`, revue corrigée.
- 2026-10-23 · **ticket 02** : SingleStepTests en test de contrat, recherche de cœurs, passage à cell80-z80 en WebAssembly (ADR 0004).
- 2026-10-23 · **ticket 04** : durée en NOPs des instructions sans préfixe, table de Madram, crédit dans `CREDITS.md`.
