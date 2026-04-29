#!/usr/bin/env bash
# Refresh data/*.json snapshots used by the OSS showcase page.
# Requires: gh, jq, curl.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/data"
ACTIVITY_DIR="$DATA_DIR/activity"
OG_DIR="$DATA_DIR/og"
OG_MANIFEST="$OG_DIR/.urls.json"
EXCLUDED_FILE="$DATA_DIR/excluded.json"
mkdir -p "$DATA_DIR" "$ACTIVITY_DIR" "$OG_DIR"

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

ext_for_content_type() {
  case "$1" in
    *image/png*)              echo png ;;
    *image/jpeg*|*image/jpg*) echo jpg ;;
    *image/webp*)             echo webp ;;
    *image/gif*)              echo gif ;;
    *)                        echo png ;;
  esac
}

og_safe_name() {
  echo "${1//\//__}"
}

cached_og_url() {
  [ -f "$OG_MANIFEST" ] || return 0
  jq -r --arg k "$1" '.[$k] // empty' "$OG_MANIFEST"
}

cached_og_file() {
  local prefix
  prefix=$(og_safe_name "$1")
  ls "$OG_DIR/$prefix".png "$OG_DIR/$prefix".jpg "$OG_DIR/$prefix".webp "$OG_DIR/$prefix".gif 2>/dev/null | head -1
}

update_og_manifest() {
  local tmp
  tmp=$(mktemp)
  if [ -f "$OG_MANIFEST" ]; then
    jq --arg k "$1" --arg v "$2" '. + {($k): $v}' "$OG_MANIFEST" > "$tmp"
  else
    jq -n --arg k "$1" --arg v "$2" '{($k): $v}' > "$tmp"
  fi
  mv "$tmp" "$OG_MANIFEST"
}

download_og_image() {
  local full_name="$1" url="$2"
  [ -z "$url" ] && return 1
  local prefix existing prev_url
  prefix=$(og_safe_name "$full_name")
  existing=$(cached_og_file "$full_name" || true)
  prev_url=$(cached_og_url "$full_name" || true)
  if [ -n "$existing" ] && [ "$prev_url" = "$url" ]; then
    basename "$existing"
    return 0
  fi
  local tmp ct ext
  tmp=$(mktemp)
  if ! ct=$(curl -sS -L --fail --connect-timeout 10 --max-time 20 \
        -A "Mozilla/5.0 unhappychoice.com refresh" \
        -o "$tmp" -w '%{content_type}' "$url" 2>/dev/null); then
    rm -f "$tmp"
    return 1
  fi
  if [ ! -s "$tmp" ]; then
    rm -f "$tmp"
    return 1
  fi
  ext=$(ext_for_content_type "$ct")
  rm -f "$OG_DIR/$prefix".png "$OG_DIR/$prefix".jpg "$OG_DIR/$prefix".webp "$OG_DIR/$prefix".gif
  mv "$tmp" "$OG_DIR/$prefix.$ext"
  update_og_manifest "$full_name" "$url"
  echo "$prefix.$ext"
}

prune_og_cache() {
  local repos_file="$1"
  [ -d "$OG_DIR" ] || return 0
  local active_json
  active_json=$(jq -c '[.[].full_name | gsub("/"; "__")]' "$repos_file")
  local f base
  for f in "$OG_DIR"/*.png "$OG_DIR"/*.jpg "$OG_DIR"/*.webp "$OG_DIR"/*.gif; do
    [ -f "$f" ] || continue
    base=$(basename "$f")
    base="${base%.*}"
    if ! jq -e --arg b "$base" --argjson keys "$active_json" \
          '$keys | index($b)' >/dev/null <<<'null'; then
      rm -f "$f"
    fi
  done
  if [ -f "$OG_MANIFEST" ]; then
    local keys_json tmp
    keys_json=$(jq -c '[.[].full_name]' "$repos_file")
    tmp=$(mktemp)
    jq --argjson keys "$keys_json" \
       'with_entries(.key as $k | select($keys | index($k)))' \
      "$OG_MANIFEST" > "$tmp"
    mv "$tmp" "$OG_MANIFEST"
  fi
}

enrich_with_og() {
  local input="$1"
  local tmp="$input.og.tmp"
  jq -c '.[]' "$input" | while read -r item; do
    full_name=$(echo "$item" | jq -r .full_name)
    og=$(scrape_og_image "$full_name" || true)
    cached=""
    if [ -n "$og" ]; then
      cached=$(download_og_image "$full_name" "$og" || true)
      sleep 0.3
    fi
    if [ -n "$cached" ]; then
      echo "$item" | jq --arg og "$og" --arg cached "../data/og/$cached" \
        '. + {og_image: $og, og_image_cached: $cached}'
    else
      echo "$item" | jq --arg og "$og" '. + {og_image: ($og | select(. != ""))}'
    fi
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

echo "→ Scraping og:image for each repo and caching locally..."
enrich_with_og "$DATA_DIR/repos.json"
prune_og_cache "$DATA_DIR/repos.json"

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
echo "---"
ls -la "$OG_DIR"
