#!/usr/bin/env bash
set -euo pipefail

DX_ENV="${DX_ENV:?DX_ENV is required}"
DX_VERSION="${DX_VERSION:-0.1.97}"

case "$DX_ENV" in
  prod | production)
    APP_ENV_FOR_BUILD="production"
    ;;
  staging)
    APP_ENV_FOR_BUILD="staging"
    ;;
  *)
    echo "Unsupported DX_ENV for admin Vercel build: $DX_ENV" >&2
    exit 64
    ;;
esac

APP_ENV="$APP_ENV_FOR_BUILD" npx -y "@ranger1/dx@${DX_VERSION}" build shared
APP_ENV="$APP_ENV_FOR_BUILD" npx -y "@ranger1/dx@${DX_VERSION}" build admin "--${DX_ENV}"
