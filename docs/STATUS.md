# STATUS

> Instantané du présent, réécrit par `/session-report`. Le détail est dans
> les rapports datés : [docs/sessions/](sessions/).

## Où on en est

Les onze tickets de la v1 sont livrés : 01 à 06, 09 et 10 par la PR #1, 07 par la PR #4, 08 par la PR #5, 11 par la PR #6.
La revue de fin de jalon v1 (code-review et security-review sur tout le diff) est livrée par une PR de la branche `review/v1-milestone`.
Elle corrige deux constats bloquants : le fichier de configuration se cherche vers le haut et fixe la racine du projet (ADR 0008),
et le matcher `toHaveRegisters` s'ajoute à `runMatchers` (ex-`memoryMatchers`). Aucune vulnérabilité trouvée.
La CI GitHub ne tourne qu'au merge dans `main`, hors Markdown seul ; avant une PR, `pnpm gate` local est le seul contrôle.
Gate local vert : 2 011 tests, plus 6 dans l'exemple. Le cœur Z80 reste cell80-z80 en WebAssembly (ADR 0004).
Modules : [docs/MODULES.md](MODULES.md), règles : [CODING_STANDARDS.md](../CODING_STANDARDS.md),
spec : [.scratch/z80-tdd-v1/spec.md](../.scratch/z80-tdd-v1/spec.md).

## Prochaine action

L'utilisateur lance `/mattpocock-skills:improve-codebase-architecture` sur `src/run.ts` ; constats d'entrée dans le dernier rapport.

## Questions ouvertes

- Compter les NOPs d'une instruction conditionnelle d'après les T-states que cell80 calcule déjà (`tick()` les jette dans `wasm/src/lib.rs`),
  au lieu du choix refait en TypeScript dans `nops.ts` ? Touche l'ADR 0002 ; ouvrirait un appel WASM par pas et `nopsOf` sans `undefined`.
- Tester le paquet tel que publié (`pnpm pack`, ou `injected: true`) avant npm ? `workspace:*` ignore `files` et les peer dependencies.

## Tickets

- Livrés : 01 à 06, 09 et 10 (PR #1), 07 (PR #4), 08 (PR #5), 11 (PR #6).
- Démarrables : aucun ; les onze tickets de la v1 sont `done`.
- Prochain : aucun ticket ; la passe d'architecture sur `src/run.ts` vient d'abord.

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
- 2026-10-23 · **revue de jalon v1** : code-review et security-review de la v1, configuration cherchée vers le haut (ADR 0008), `toHaveRegisters`.
