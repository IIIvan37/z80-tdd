# Session — 2026-10-23 — w-ci-on-merge-only

- **Branche :** `ci/skip-docs-only`, PR #3 ouverte, empilée sur `docs/v1-first-pr-report` (PR #2 ouverte)
- **Objet :** ne plus lancer la CI pour de la documentation, ni deux fois par push.

## Fait

- `.github/workflows/ci.yml` : `on: push: branches: [main]` avec `paths-ignore: ["**.md"]` ; plus de déclencheur `pull_request`.
  La CI tourne une fois par merge dans `main`, sauf si le merge ne touche que du Markdown (`docs/` et `.scratch/` n'ont que du `.md`).
- Constat avant le changement : `push` sans filtre + `pull_request` lançaient deux exécutions identiques par push sur une branche de PR.
- Le dépôt privé n'a pas de protection de branche (403, demande GitHub Pro) : aucune PR n'attend un check absent.
- CI de `main` après le merge de la PR #1 : verte (`39955571094`, 2 min 47).
- `ci/skip-docs-only` rebasée sur `docs/v1-first-pr-report` : les deux PR réécrivent le STATUS.

## Non fait / reste

- Ce que la CI au seul merge laisse passer jusqu'à `main` : un gate rouge, et un `cell80.wasm` qui ne correspond plus à sa source
  (le job `core` le vérifie, `pnpm gate` non).

## Décisions

- Choix de l'utilisateur : la CI au merge suffit ; rien pour les branches ni les PR ; rien pour un changement Markdown seul.
- Le pourquoi est en commentaire en tête de `ci.yml`.

## Gate

- `pnpm gate` → vert : typecheck, Biome (30 fichiers), dependency-cruiser (27 modules, 0 violation), Vitest 1 961/1 961.
- CI GitHub → non lancée pour la PR #3, par construction ; elle tournera au merge.

## État pour reprendre

- **Prochaine action :** ticket 07 (Ports), sur une branche partie de `main`, une fois les PR #2 et #3 fusionnées.
- **Arbre :** propre après le commit de ce rapport ; PR #2 puis PR #3 à fusionner, dans cet ordre.
- **Pièges :**
  - Avant chaque PR, `pnpm gate` local est le seul contrôle ; si `wasm/` change, lancer aussi `pnpm build:wasm` et vérifier `git diff src/cpu/cell80.wasm`.
  - Tri des rapports du même jour : `-2` trie avant `.md` ; le slug de celui-ci commence par `w-` pour trier après `v1-first-pr`.
