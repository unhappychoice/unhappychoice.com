# unhappychoice.com

Personal site for [@unhappychoice](https://github.com/unhappychoice), served from GitHub Pages at <https://unhappychoice.com>.

It is a small static site with two pages and an hourly data-refresh job that
keeps the OSS showcase in sync with GitHub.

## Pages

- `index.html`: profile, skills, philosophy, links.
- `oss/index.html`: OSS showcase. Lists repositories across
  [`unhappychoice`](https://github.com/unhappychoice) and four orgs
  (`circleci-tools`, `bitflyer-tools`, `irasutoya-tools`, `kotlinz`,
  `deariary`), with stats, language filter, and a per-repo activity modal.

## Layout

```
index.html             Profile page
oss/index.html         OSS showcase page
style.css              Shared stylesheet
js/repos.js            Renders repo cards, filter, sort, modal
js/stats.js            Renders aggregate stats block
images/                Static assets (avatar, etc.)
data/
  repos.json           Repo metadata snapshot (generated)
  stats.json           Aggregate stats snapshot (generated)
  activity/*.json      Per-repo recent events (generated)
  featured.json        Hand-written highlights shown on top of the showcase
  excluded.json        Repo full_names to hide from the showcase
scripts/refresh-data.sh   Regenerates data/*.json from the GitHub API
.github/workflows/refresh-data.yml   Hourly cron that runs the script and commits
CNAME                  GitHub Pages custom domain
```

No build step. The site is plain HTML / CSS / vanilla JS loaded directly by
GitHub Pages.

## Local preview

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Refreshing data manually

Requires `gh`, `jq`, and `curl`. `gh` must be authenticated.

```sh
./scripts/refresh-data.sh
```

This rewrites `data/repos.json`, `data/stats.json`, and `data/activity/*.json`.
The hourly GitHub Actions workflow runs the same script and commits the diff
as `chore(data): refresh OSS snapshots`.

## Editing the showcase

- **Highlight a repo**: add an entry to `data/featured.json`. The order in
  this file controls the order in the "Featured" sort.
- **Hide a repo**: add its `full_name` (e.g. `owner/name`) to
  `data/excluded.json`. The next refresh will drop it.
- **Add a tracked org**: append to the `ORGS` array in
  `scripts/refresh-data.sh`.
