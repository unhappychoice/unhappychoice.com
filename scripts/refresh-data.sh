#!/usr/bin/env bash
# Refresh data/*.json snapshots used by the OSS showcase page.
# Requires: gh, jq, curl.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/data"
ACTIVITY_DIR="$DATA_DIR/activity"
EXCLUDED_FILE="$DATA_DIR/excluded.json"
mkdir -p "$DATA_DIR" "$ACTIVITY_DIR"

USER_LOGIN="unhappychoice"
ORGS=(circleci-tools bitflyer-tools irasutoya-tools kotlinz deariary)

excluded_filter() {
  if [ -f "$EXCLUDED_FILE" ]; then
    jq --slurpfile excluded "$EXCLUDED_FILE" 'map(select(.full_name as $n | $excluded[0] | index($n) | not))'
  else
    cat
  fi
}

scrape_og_image() {
  local full_name="$1"
  curl -sS -L -A "Mozilla/5.0 unhappychoice.com refresh" "https://github.com/$full_name" \
    | grep -oE '<meta property="og:image" content="[^"]+"' \
    | head -1 \
    | sed 's/.*content="//;s/"$//'
}

enrich_with_og() {
  local input="$1"
  local tmp="$input.og.tmp"
  jq -c '.[]' "$input" | while read -r item; do
    full_name=$(echo "$item" | jq -r .full_name)
    og=$(scrape_og_image "$full_name" || true)
    echo "$item" | jq --arg og "$og" '. + {og_image: ($og | select(. != "") )}'
  done | jq -s '.' > "$tmp"
  mv "$tmp" "$input"
}

fetch_repos() {
  (
    gh api "users/$USER_LOGIN/repos?per_page=100&sort=updated&type=owner" --paginate
    for org in "${ORGS[@]}"; do
      gh api "orgs/$org/repos?per_page=100&sort=updated" --paginate
    done
  ) | jq -s '
    add
    | map(select(.fork == false and .private == false))
    | map({
        name, full_name, owner: .owner.login,
        description, html_url, homepage, language, topics,
        stargazers_count, forks_count, open_issues_count,
        archived, pushed_at, updated_at, created_at
      })
    | sort_by(-.stargazers_count)
  ' | excluded_filter
}

fetch_repo_activity() {
  local full_name="$1"
  local out_file="$ACTIVITY_DIR/${full_name//\//__}.json"
  local events_file releases_file existing_file
  events_file=$(mktemp) && releases_file=$(mktemp) && existing_file=$(mktemp)
  gh api "repos/$full_name/events?per_page=30" > "$events_file" 2>/dev/null || echo "[]" > "$events_file"
  gh api "repos/$full_name/releases?per_page=10" > "$releases_file" 2>/dev/null || echo "[]" > "$releases_file"
  if [ -f "$out_file" ]; then cp "$out_file" "$existing_file"; else echo "[]" > "$existing_file"; fi
  jq -n \
    --slurpfile events "$events_file" \
    --slurpfile releases "$releases_file" \
    --slurpfile existing "$existing_file" '
    ($events[0]
      | map(select(.type == "PushEvent" or .type == "PullRequestEvent" or .type == "ReleaseEvent" or .type == "IssuesEvent" or .type == "CreateEvent"))
      | map({
          type, created_at,
          action: (.payload.action // null),
          ref: (.payload.ref // null),
          ref_type: (.payload.ref_type // null),
          pr_title: (.payload.pull_request.title // null),
          pr_number: (.payload.pull_request.number // null),
          pr_merged: (.payload.pull_request.merged // null),
          pr_url: (.payload.pull_request.html_url // null),
          issue_title: (.payload.issue.title // null),
          issue_number: (.payload.issue.number // null),
          issue_url: (.payload.issue.html_url // null),
          release_name: (.payload.release.name // null),
          release_tag: (.payload.release.tag_name // null),
          release_url: (.payload.release.html_url // null),
          commit_count: (.payload.commits | length // null)
        }))
    +
    ($releases[0]
      | map(select(.draft == false))
      | map({
          type: "ReleaseEvent",
          created_at: .published_at,
          action: "published",
          ref: null, ref_type: null,
          pr_title: null, pr_number: null, pr_merged: null, pr_url: null,
          issue_title: null, issue_number: null, issue_url: null,
          release_name: .name,
          release_tag: .tag_name,
          release_url: .html_url,
          commit_count: null
        }))
    + ($existing[0])
    | unique_by([.type, .created_at, .release_tag, .pr_number, .issue_number, .ref])
    | sort_by(.created_at) | reverse
    | .[0:30]
  ' > "$out_file.tmp" && mv "$out_file.tmp" "$out_file"
  rm -f "$events_file" "$releases_file" "$existing_file"
}

build_stats() {
  jq '
    {
      generated_at: (now | strftime("%Y-%m-%dT%H:%M:%SZ")),
      total_repos: length,
      total_stars: (map(.stargazers_count) | add),
      total_forks: (map(.forks_count) | add),
      archived_count: (map(select(.archived)) | length),
      languages: (
        map(.language) | map(select(. != null))
        | group_by(.) | map({language: .[0], count: length})
        | sort_by(-.count)
      ),
      by_owner: (
        group_by(.owner)
        | map({owner: .[0].owner, repo_count: length, stars: (map(.stargazers_count) | add)})
        | sort_by(-.stars)
      ),
      top_topics: (
        map(.topics // []) | flatten
        | group_by(.) | map({topic: .[0], count: length})
        | sort_by(-.count) | .[0:20]
      )
    }
  ' "$DATA_DIR/repos.json"
}

echo "→ Fetching repos..."
fetch_repos > "$DATA_DIR/repos.json.tmp"
mv "$DATA_DIR/repos.json.tmp" "$DATA_DIR/repos.json"

echo "→ Scraping og:image for each repo..."
enrich_with_og "$DATA_DIR/repos.json"

echo "→ Fetching per-repo activity..."
while IFS= read -r repo; do
  echo "  · $repo"
  fetch_repo_activity "$repo"
done < <(jq -r '.[].full_name' "$DATA_DIR/repos.json")

echo "→ Building stats..."
build_stats > "$DATA_DIR/stats.json.tmp"
mv "$DATA_DIR/stats.json.tmp" "$DATA_DIR/stats.json"

echo "Done."
ls -la "$DATA_DIR"
echo "---"
ls -la "$ACTIVITY_DIR"
