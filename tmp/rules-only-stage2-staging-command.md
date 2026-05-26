# Rules-Only Stage 2 PM2 Staging Command

Run after deploying this branch to staging PM2:

```bash
dx start stack
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/codegen-to-deploy-pipeline.e2e-spec.ts
node apps/quantify/dist/apps/quantify/src/modules/llm-strategy-codegen/scripts/staging30-rules-only-mainflow-report.js
```

Acceptance:

- 30/30 cases start from new sessions.
- 0 cases use old session migration.
- 0 cases use flat fallback.
- Each case records rulesHash, canonicalSpecHash, irHash, astHash, scriptHash, runtimeEvaluatorVersion.
