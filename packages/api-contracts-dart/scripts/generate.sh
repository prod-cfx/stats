#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PROJECT_DIR/../.." && pwd)"
OPENAPI_FILE="$PROJECT_DIR/openapi/openapi.json"
BACKEND_OPENAPI_FILE="$REPO_ROOT/dist/openapi/backend.json"
OUTPUT_DIR="$PROJECT_DIR"

if [[ "${1:-}" == "--skip-export" ]]; then
  echo "skip backend swagger export"
else
  echo "export backend swagger"
  cd "$REPO_ROOT"
  npx nx run backend:swagger
  mkdir -p "$PROJECT_DIR/openapi"
  cp "$BACKEND_OPENAPI_FILE" "$OPENAPI_FILE"
fi

if [ ! -f "$OPENAPI_FILE" ]; then
  echo "missing $OPENAPI_FILE"
  exit 1
fi

rm -rf "$OUTPUT_DIR/lib" "$OUTPUT_DIR/test" "$OUTPUT_DIR/doc" "$OUTPUT_DIR/.openapi-generator"

cd "$PROJECT_DIR"
npx --yes @openapitools/openapi-generator-cli generate \
  -i "$OPENAPI_FILE" \
  -g dart-dio \
  -o "$OUTPUT_DIR" \
  --skip-validate-spec \
  --additional-properties=pubName=backend_api_contracts,pubVersion=0.0.1,nullableFields=true,useEnumExtension=true

node "$SCRIPT_DIR/patch-generated-dart.mjs"

if command -v dart >/dev/null 2>&1; then
  dart pub get
  dart run build_runner build --delete-conflicting-outputs
  # 只分析交付产物 lib/（generated test/ 缺 package:test dev_dependency，非交付物）。
  # dart-dio 生成代码自带 unused_import/duplicate_import 等 warning 与大量 style info，
  # 均为生成器产物噪声、非业务缺陷；用 --no-fatal-warnings 让真正的 error 仍致命、
  # 而生成噪声不阻断构建（验收语义：产物可编译可用即通过）。
  dart analyze --no-fatal-warnings lib
else
  echo "dart command not found; run manually: cd packages/api-contracts-dart && dart pub get && dart run build_runner build --delete-conflicting-outputs && dart analyze"
fi
