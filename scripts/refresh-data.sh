#!/usr/bin/env bash
# Refresh data/*.json snapshots used by the OSS showcase page.
# Requires: gh, jq.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="$ROOT/data"
mkdir -p "$DATA_DIR"

USER_LOGIN="unhappychoice"
ORGS=(circleci-tools bitflyer-tools irasutoya-tools kotlinz)

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
  '
}

fetch_events() {
  (
    gh api "users/$USER_LOGIN/events/public?per_page=100"
    for org in "${ORGS[@]}"; do
      gh api "orgs/$org/events?per_page=100" 2>/dev/null || echo "[]"
    done
  ) | jq -s '
    add
    | map(select(.type == "PushEvent" or .type == "PullRequestEvent" or .type == "ReleaseEvent" or .type == "IssuesEvent" or .type == "CreateEvent"))
    | map({
        type, actor: .actor.login, repo: .repo.name, created_at,
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
      })
    | sort_by(.created_at) | reverse
    | .[0:50]
  '
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

echo "→ Fetching events..."
fetch_events > "$DATA_DIR/events.json.tmp"
mv "$DATA_DIR/events.json.tmp" "$DATA_DIR/events.json"

echo "→ Building stats..."
build_stats > "$DATA_DIR/stats.json.tmp"
mv "$DATA_DIR/stats.json.tmp" "$DATA_DIR/stats.json"

echo "Done. Wrote:"
ls -la "$DATA_DIR"
