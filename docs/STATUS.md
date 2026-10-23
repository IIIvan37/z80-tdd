# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Les onze tickets de la v1 sont livrés, puis la revue de jalon v1 (PR #7, ADR 0008).
La passe d'architecture sur `src/run.ts` est livrée par les PR #8 et #10 (la #9, fusionnée dans la branche de la #8, est remplacée par la #10).
Le vocabulaire Z80 (registres, flags, `hex`, contrôles de nombres) vit dans le module CPU ; le Run et un Stub refusent un registre inconnu ou `undefined`.
Le Stub tient dans la classe privée `Stubs`, `SuppliedPorts` contrôle ses ports, et la complexité Sonar de `run()` passe de 32 à 15 au plus.
La CI GitHub ne tourne qu'au merge dans `main`, hors Markdown seul ; avant une PR, `pnpm gate` local est le seul contrôle.
Gate local vert : 2 015 tests, plus 6 dans l'exemple. Le cœur Z80 reste cell80-z80 en WebAssembly (ADR 0004).
Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

Trancher la question des T-states de cell80 (ci-dessous), seule question ouverte avant un nouveau ticket.

## Questions ouvertes

- Compter les NOPs d'une instruction d'après les cycles que cell80 donne à `tick()` (ignoré dans `wasm/src/lib.rs`),
  au lieu de la table de `nops.ts` ? Touche l'ADR 0002 ; le coût d'un pas ne serait connu qu'après `step()`.
- Tester le paquet tel que publié (`pnpm pack`, ou `injected: true`) avant npm ? `workspace:*` ignore `files` et les peer dependencies.

## Tickets

- Livrés : 01 à 06, 09 et 10 (PR #1), 07 (PR #4), 08 (PR #5), 11 (PR #6) ; revue de jalon v1 (PR #7) ; architecture de `run.ts` (PR #8, #10).
- Démarrables : aucun ; les onze tickets de la v1 sont `done`.
- Prochain : aucun ticket ; la question des T-states vient d'abord.

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
- 2026-10-23 · **ticket 07** : Port writes, Port reads par séquence ou fonction, Port mask `#FF00` (ADR 0007), PR #4.
- 2026-10-23 · **ticket 08** : Stubs par label ou adresse, `stubCalls`, coût d'un `RET` par défaut, ligne `Stub` du rapport, PR #5.
- 2026-10-23 · **ticket 11** : projet d'exemple sur le paquet bâti, `pnpm build` réparé, `LICENSE`, README, PR #6.
- 2026-10-23 · **revue de jalon v1** : code-review et security-review de la v1, configuration cherchée vers le haut (ADR 0008), `toHaveRegisters`, PR #7.
- 2026-10-23 · **architecture de run.ts** : vocabulaire Z80 dans le module CPU, classe `Stubs`, complexité de `run()` sous 15, PR #8 et #10.
