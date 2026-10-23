# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Le ticket 09 est livré : `rasmAssembler` assemble un Program avec le vrai `rasm` (blocs `ORG` à leur adresse de stockage, labels et `EQU`,
erreurs avec fichier et ligne, lien de téléchargement si `rasm` manque). Le Program trouve un label quelle que soit sa casse (ADR 0006).
Gate `pnpm gate` vert, 1 943 tests, contrats RASM compris. Le cœur Z80 reste cell80-z80 en WebAssembly (ADR 0004).
Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Lancer `mattpocock-skills:tdd` sur le ticket 10 (fichier de configuration), sur une branche qui part du ticket 09.

## Questions ouvertes

- Quand créer le dépôt privé `IIIvan37/z80-tdd` et fusionner les branches empilées dans `main` par PR ? La CI n'a jamais tourné.
- Un label inconnu doit-il porter le rapport d'échec ? Aujourd'hui non (il échoue avant le premier pas) ; à trancher avec les Stubs (ticket 08).

## Tickets

- Livrés : 01, 02, 03, 04, 05, 06, 09.
- Démarrables : 07, 08, 10.
- Prochain : 10 (avec 07 et 08, débloque 11).

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **ticket 01** : outillage, API publique, Run avec sentinelle, module CPU sur `z80-emulator`, revue corrigée.
- 2026-10-23 · **ticket 02** : SingleStepTests en test de contrat, recherche de cœurs, passage à cell80-z80 en WebAssembly (ADR 0004).
- 2026-10-23 · **ticket 04** : durée en NOPs des instructions sans préfixe, table de Madram, crédit dans `CREDITS.md`.
- 2026-10-23 · **ticket 06** : NOP limit, rapport d'échec avec désassembleur de cell80, `HALT` compté, `registers()` 40 fois plus rapide.
- 2026-10-23 · **ticket 05** : NOPs des instructions préfixées et répétées, chaînes de préfixes, `ld (ix+n),n` calculé par la règle de Madram.
- 2026-10-23 · **ticket 03** : mémoire avant et après un Run, Memory changes sans la pile (ADR 0005), Matchers, revue corrigée.
- 2026-10-23 · **ticket 09** : Assembler RASM (fichier englobant, listing `-map`), labels sans casse (ADR 0006), RASM v3.3.1 en CI, revue corrigée.
