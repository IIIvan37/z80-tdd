# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Le ticket 05 est livré : chaque opcode que cell80 exécute a un compte de NOPs, préfixé (CB, ED, DD, FD, DDCB, FDCB) ou non, et les instructions de
bloc répétées coûtent 6 NOPs par itération puis 5 (4 pour `CPIR`, `CPDR`) à la dernière. Gate `pnpm gate` vert, 1 915 tests à l'API publique.
Le cœur Z80 reste cell80-z80 en WebAssembly (ADR 0004). Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Lancer `/implement` sur le ticket 03 (mémoire avant et après un Run), sur une branche qui part du ticket 05.

## Questions ouvertes

- Quand créer le dépôt privé `IIIvan37/z80-tdd` et fusionner les branches empilées dans `main` par PR ? La CI n'a jamais tourné.
- Un label inconnu doit-il porter le rapport d'échec ? Aujourd'hui non (il échoue avant le premier pas) ; à trancher avec les Stubs (ticket 08).

## Tickets

- Livrés : 01, 02, 04, 05, 06.
- Démarrables : 03, 07, 08, 09.
- Prochain : 03 (débloque 11 avec 07, 08 et 10).

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **ticket 01** : outillage, API publique, Run avec sentinelle, module CPU sur `z80-emulator`, revue corrigée.
- 2026-10-23 · **ticket 02** : SingleStepTests en test de contrat, recherche de cœurs, passage à cell80-z80 en WebAssembly (ADR 0004).
- 2026-10-23 · **ticket 04** : durée en NOPs des instructions sans préfixe, table de Madram, crédit dans `CREDITS.md`.
- 2026-10-23 · **ticket 06** : NOP limit, rapport d'échec avec désassembleur de cell80, `HALT` compté, `registers()` 40 fois plus rapide.
- 2026-10-23 · **ticket 05** : NOPs des instructions préfixées et répétées, chaînes de préfixes, `ld (ix+n),n` calculé par la règle de Madram.
