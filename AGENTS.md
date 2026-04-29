# AGENTS.md

Instructions for AI coding agents working in this repository. Humans should
read `README.md` first.

## What this repo is

A static GitHub Pages site (`unhappychoice.com`). Two HTML pages, one
stylesheet, two vanilla JS files, and a JSON data directory that is
regenerated hourly by a shell script. **No build step, no package manager,
no framework.** Do not introduce one.

## Ground rules

- **Language**: write code, comments, commit messages, and PR descriptions
  in English. Reply to the user in Japanese.
- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore(data):`, ...).
- **PR merges**: never `--squash`; use a regular merge commit (`--merge`).
- **Style**: keep functions small (10 to 15 lines) and files around 100 lines
  where practical. Prefer `map`/`filter`/`reduce` over imperative loops.
  Public functions/classes go near the top of a file. Avoid comments when a
  well-named function would do.
- **Don't add tooling**: no bundler, no TypeScript, no npm dependencies, no
  CSS framework beyond the existing CDN Bootstrap reboot. The whole point is
  that this site is trivially hostable on GitHub Pages.

## File map

| Path | Purpose | Notes for edits |
|---|---|---|
| `index.html` | Profile page | Hand-edited content. |
| `oss/index.html` | OSS showcase shell | Stats + repos roots + modal markup. |
| `style.css` | All styles | One file. Keep it that way. |
| `js/repos.js` | Repo cards, filter, sort, activity modal | Vanilla JS, IIFE. |
| `js/stats.js` | Aggregate stats block | Vanilla JS, IIFE. |
| `data/repos.json` | Generated. **Don't hand-edit.** | Output of `refresh-data.sh`. |
| `data/stats.json` | Generated. **Don't hand-edit.** | Output of `refresh-data.sh`. |
| `data/activity/*.json` | Generated. **Don't hand-edit.** | Per-repo event history. |
| `data/featured.json` | Hand-written featured repo blurbs | Order = display order. |
| `data/excluded.json` | List of `owner/name` to hide | Drops from the next refresh. |
| `scripts/refresh-data.sh` | Pulls GitHub data into `data/` | Needs `gh`, `jq`, `curl`. |
| `.github/workflows/refresh-data.yml` | Hourly cron that runs the script | Commits via `GITHUB_TOKEN`. |
| `CNAME` | `unhappychoice.com` | Don't change. |

## Common tasks

### Changing what the OSS showcase shows
- Featured order / blurbs → `data/featured.json`.
- Hide a repo → add to `data/excluded.json`.
- Track a new org → append to `ORGS` in `scripts/refresh-data.sh`, then run
  the script (or trigger the workflow) to regenerate snapshots.
- Filter chip ordering / hidden languages → `LANG_ORDER` and `HIDDEN_LANGS`
  in `js/repos.js`.

### Editing UI behavior
- Repo card / modal markup lives entirely in `js/repos.js`. Keep DOM
  construction in template-string helpers; do not add a templating library.
- Stats block markup lives entirely in `js/stats.js`.
- Styles go in `style.css`. Reuse existing class names where possible
  (`.repos-root`, `.stats-root`, `.modal`, `.filter-chip`, …).

### Running the data refresh locally
```sh
./scripts/refresh-data.sh
```
Requires authenticated `gh`. The script is idempotent: re-running just
overwrites snapshots. Activity files merge with the previous snapshot, dedupe
by event identity, and cap at 30 entries per repo.

### Local preview
```sh
python3 -m http.server 8000
```
There is no other dev server.

## What to leave alone

- Generated files under `data/` (except `featured.json` and `excluded.json`).
- The hourly workflow's commit message format
  (`chore(data): refresh OSS snapshots`); the cron commits with this exact
  subject.
- `CNAME` and `.nojekyll`.

## When in doubt

This is a personal site. Bias toward **smaller, fewer changes**. If a task
seems to require adding a build step, a framework, or a new top-level
directory, stop and ask first.
