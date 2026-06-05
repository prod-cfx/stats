# backend_api_contracts

Stats backend OpenAPI Dart client for `apps/quantify-mobile`.

Reference implementation: `/home/ubuntu/ranger_work/ai-monorepo/packages/api-contracts-dart`.

## Generate

```bash
dx build contracts-dart --dev
```

Skip swagger export when `packages/api-contracts-dart/openapi/openapi.json` already exists:

```bash
packages/api-contracts-dart/scripts/generate.sh --skip-export
```

## Requirements

- Node and pnpm from repo baseline
- Java 11+ for `@openapitools/openapi-generator-cli`
- Dart SDK `^3.11.5`

## Mobile dependency

```yaml
backend_api_contracts:
  path: ../../packages/api-contracts-dart
```

Generated files under `lib/` are not hand edited.
