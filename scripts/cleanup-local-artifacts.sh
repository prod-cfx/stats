#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ $# -gt 1 ]]; then
  printf 'usage: %s [--dry-run]\n' "${0##*/}" >&2
  exit 1
fi

dry_run="${1:-}"

if [[ -n "$dry_run" && "$dry_run" != "--dry-run" ]]; then
  printf 'usage: %s [--dry-run]\n' "${0##*/}" >&2
  exit 1
fi

targets=(
  "dist"
  "apps/front/.next"
  "apps/admin-front/.next"
  "apps/backend/dist"
  "apps/quantify/dist"
  "packages/config/dist"
  "packages/shared/dist"
)

cd "$repo_root"

for target in "${targets[@]}"; do
  if [[ -e "$target" ]]; then
    if [[ "$dry_run" == "--dry-run" ]]; then
      printf '[dry-run] would remove %s\n' "$target"
    else
      rm -rf -- "$target"
      printf 'removed %s\n' "$target"
    fi
  fi
done
