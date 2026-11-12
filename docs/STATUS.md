# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

La version 0.2.0 est publiée comme GitHub release, avec son tarball : <https://github.com/IIIvan37/z80-tdd/releases/tag/v0.2.0>.
Elle apporte FantAMS (PR #6) et les follow-ups (PR #8). Les précédentes : 0.1.0 (2026-10-24), 0.1.1 (2026-11-08, PR #5).
z80-tdd n'est pas sur npm (ADR 0009) : un projet CPC l'installe par l'URL du tarball, et l'exemple passe ainsi dans un projet neuf.
Le dépôt GitHub est public depuis le 2026-10-23. Il a été recréé avec un historique réécrit : les PR #1 à #10 des rapports du 2026-10-23
appartenaient à l'ancien dépôt, supprimé.
Deux Assemblers : RASM et `fantamsAssembler()`, qui lit le `.fo` (ADR 0010). Un source absent échoue avant l'Assembler.
Un nom qui correspond à plusieurs labels, casse ignorée, échoue pour tout Assembler (ADR 0006).
La durée d'un pas reste lue dans la table de Madram (ADR 0002). `pnpm test:core` la compare à l'horloge de cell80 : 18 écarts connus.
Gate local vert : 2 042 tests, plus 6 dans l'exemple ; `pnpm test:core` vert (3 209).
La CI GitHub ne tourne qu'au merge dans `main`, hors Markdown seul.
Le dépôt public `IIIvan37/z80-tdd-sorts` emploie encore z80-tdd 0.1.0 par son tarball. Il porte sept articles livrés, de `intro` à `strcmp`.
Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
specs : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md), [.scratch/fantams-assembler/spec.md](../.scratch/fantams-assembler/spec.md),
[.scratch/follow-ups/spec.md](../.scratch/follow-ups/spec.md).

## Prochaine action

Cadrer l'étape suivante avec l'utilisateur : aucune n'est prévue.

## Questions ouvertes

- Extraire le code commun aux adaptateurs RASM et FantAMS : attendu jusqu'à un troisième Assembler.

## Tickets

- Livrés : les onze tickets de la v1, la revue de jalon v1 et l'architecture de `run.ts` (PR de l'ancien dépôt).
- Livrés : FantAMS 01 et 02 (`.scratch/fantams-assembler/issues/`), par la PR #6.
- Livrés : follow-ups 01 à 03 (`.scratch/follow-ups/issues/`), par la PR #8.
- Démarrables : aucun.
- Prochain : aucun ticket.

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **tickets 01 à 06** : outillage, Run avec sentinelle, cell80-z80 en WebAssembly (ADR 0004), NOPs de Madram, NOP limit.
- 2026-10-23 · **tickets 03, 09, 10** : Memory changes (ADR 0005), Assembler RASM (ADR 0006), fichier de configuration.
- 2026-10-23 · **première PR** : dépôt distant, `simplify` sur tout le code, README, CI verte ; CI au seul merge dans `main`.
- 2026-10-23 · **tickets 07, 08, 11** : Port reads et Port mask (ADR 0007), Stubs, projet d'exemple sur le paquet bâti.
- 2026-10-23 · **revue de jalon v1** : code-review et security-review, configuration cherchée vers le haut (ADR 0008), `toHaveRegisters`.
- 2026-10-23 · **architecture de run.ts** : vocabulaire Z80 dans le module CPU, classe `Stubs`, complexité de `run()` sous 15.
- 2026-10-24 · **release 0.1.0** : mesure des T-states, dépôt public à l'historique réécrit, tarball de release (ADR 0009).
- 2026-10-25 · **status-sorts-repo** : STATUS pointé vers `z80-tdd-sorts`, question npm complétée (PR #3).
- 2026-11-08 · **release 0.1.1** : listing RASM de plus de 1 Mo (PR #5).
- 2026-11-12 · **FantAMS** : label ambigu par la casse (ADR 0006), `fantamsAssembler()` lisant le `.fo` (ADR 0010), revue, PR #6.
- 2026-11-12 · **follow-ups** : PR #7 (pas de npm), source absent, EQU signé, `nops.ts` contre l'horloge cell80, revue, PR #8.
- 2026-11-12 · **release 0.2.0** : PR #9, release `v0.2.0` et son tarball, vérifié dans un projet neuf.
