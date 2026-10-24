# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

La version 0.1.0 est publiée comme GitHub release, avec son tarball : <https://github.com/IIIvan37/z80-tdd/releases/tag/v0.1.0>.
z80-tdd n'est pas sur npm (ADR 0009) : un projet CPC l'installe par l'URL du tarball, et l'exemple passe ainsi dans un projet neuf.
Le dépôt GitHub est public depuis le 2026-10-23. Il a été recréé avec un historique réécrit : les PR #1 à #10 des rapports du 2026-10-23
appartenaient à l'ancien dépôt, supprimé. Le README pour la 0.1.0 est la PR #1 du nouveau dépôt.
La durée d'un pas reste lue dans la table de Madram (ADR 0002) : la mesure sur cell80 est dans le rapport du 2026-10-24.
Gate local vert : 2 015 tests, plus 6 dans l'exemple. La CI GitHub ne tourne qu'au merge dans `main`, hors Markdown seul.
Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Cadrer le dépôt des tris (premier tri, nommage des branches et des tags par étape du TDD) avant son premier commit.

## Questions ouvertes

- Ajouter un test qui compare `nops.ts` au modèle d'alignement des `tick()` de cell80 (3 524 accords sur 3 560, 36 exceptions connues) ?
- Publier sur npm, et quand ? Prématuré pour la 0.1.0.

## Tickets

- Livrés : les onze tickets de la v1, la revue de jalon v1 et l'architecture de `run.ts` (PR de l'ancien dépôt).
- Démarrables : aucun ; les onze tickets de la v1 sont `done`.
- Prochain : aucun ticket dans ce dépôt ; le travail suivant est le dépôt des tris.

## Historique

- 2026-10-23 · **cadrage** : configuration des skills, entretien, ADR 0001 à 0003, spec v1, onze tickets.
- 2026-10-23 · **tickets 01 à 06** : outillage, Run avec sentinelle, cell80-z80 en WebAssembly (ADR 0004), NOPs de Madram, NOP limit.
- 2026-10-23 · **tickets 03, 09, 10** : Memory changes (ADR 0005), Assembler RASM (ADR 0006), fichier de configuration.
- 2026-10-23 · **première PR** : dépôt distant, `simplify` sur tout le code, README, CI verte ; CI au seul merge dans `main`.
- 2026-10-23 · **tickets 07, 08, 11** : Port reads et Port mask (ADR 0007), Stubs, projet d'exemple sur le paquet bâti.
- 2026-10-23 · **revue de jalon v1** : code-review et security-review, configuration cherchée vers le haut (ADR 0008), `toHaveRegisters`.
- 2026-10-23 · **architecture de run.ts** : vocabulaire Z80 dans le module CPU, classe `Stubs`, complexité de `run()` sous 15.
- 2026-10-24 · **release 0.1.0** : mesure des T-states, dépôt public à l'historique réécrit, tarball de release (ADR 0009).
