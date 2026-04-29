#!/usr/bin/env bash
set -euo pipefail

DX_VERSION="${DX_VERSION:-0.1.97}"

build_env="${DX_ENV:-${APP_ENV:-}}"

case "$build_env" in
  prod|production)
    APP_ENV_FOR_BUILD="production"
    DX_ENV_FLAG="--prod"
    ;;
  staging)
    APP_ENV_FOR_BUILD="staging"
    DX_ENV_FLAG="--staging"
    ;;
  *)
    echo "Unsupported admin Vercel build environment: ${build_env:-<empty>}" >&2
    exit 64
    ;;
esac

run_dx() {
  if [[ "${VERCEL_BUILD_DRY_RUN:-}" == "1" ]]; then
    printf 'APP_ENV=%s npx -y @ranger1/dx@%s %s\n' "$APP_ENV_FOR_BUILD" "$DX_VERSION" "$*"
    return
  fi

  APP_ENV="$APP_ENV_FOR_BUILD" npx -y "@ranger1/dx@${DX_VERSION}" "$@"
}

run_dx build admin "$DX_ENV_FLAG"
