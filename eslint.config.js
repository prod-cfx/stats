import { readFileSync } from 'node:fs'
import antfu from '@antfu/eslint-config'
import noAtomKeyLiteral from './eslint-rules/no-atom-key-literal.js'
import noBusinessRuleInDispatcher from './eslint-rules/no-business-rule-in-dispatcher.js'

// pnpm generate:enums 自动维护，无需手动同步
let prismaEnumNames = []
try {
  prismaEnumNames = JSON.parse(
    readFileSync(new URL('./packages/shared/src/generated/prisma-enum-names.json', import.meta.url), 'utf-8'),
  )
}
catch {
  console.warn('[eslint.config.js] prisma-enum-names.json not found — enum restriction disabled. Run: pnpm generate:enums')
}
const prismaEnumPattern = prismaEnumNames.length > 0
  ? `^(${prismaEnumNames.join('|')}|\\$Enums)$`
  : `^\\$Enums$`

export default antfu(
  {
    type: 'lib',
    ignores: [
      'dist',
      'node_modules',
      'coverage',
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/temp/**',
      'apps/backend/src/generated/**',
      'apps/quantify/generated/**',
      'apps/admin-front/dist/**',
      'apps/admin-front/.next/**',
      'apps/admin-front/build/**',
      // TradingView Charting Library（第三方压缩产物，不参与 lint）
      'apps/front/public/tradingview/**',
      'apps/front/vendor/**',
      'apps/sdk/src/**',
      'packages/api-contracts/src/generated/**',
      '**/*.md',
      'docs/**',
    ],
    formatters: {
      css: true,
      html: true,
      markdown: 'prettier',
    },
    typescript: true,
    react: true,
    stylistic: false,
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'error',
      'react/no-array-index-key': 'off',
      'react/no-useless-forward-ref': 'off',
      'react/display-name': 'off',
      'no-case-declarations': 'error',
      'no-redeclare': 'error',
      'no-useless-catch': 'error',
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
      'perfectionist/sort-named-imports': 'off',
      'unused-imports/no-unused-imports': 'off',
      'ts/no-unused-vars': 'off',
      'unicorn/number-literal-case': ['error', { hexadecimalValue: 'lowercase' }],
    },
  },
  {
    files: ['apps/front/**/*.{ts,tsx}', 'apps/admin-front/**/*.{ts,tsx}'],
    rules: {
      'react/no-forward-ref': 'off',
      'react/no-use-context': 'off',
      'react/no-context-provider': 'off',
      'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
      'react-web-api/no-leaked-event-listener': 'off',
      'react-web-api/no-leaked-timeout': 'off',
      'react-refresh/only-export-components': 'off',
      'react-dom/no-missing-button-type': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['apps/front/src/lib/**/*.ts'],
    rules: {
      'perfectionist/sort-named-imports': 'off',
      'unused-imports/no-unused-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'ts/no-unused-vars': 'off',
    },
  },
  {
    files: ['apps/front/src/lib/api.ts', 'apps/front/src/lib/server-api.ts'],
    rules: {
      'perfectionist/sort-named-imports': 'off',
      'unused-imports/no-unused-imports': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'ts/no-unused-vars': 'off',
    },
  },
  {
    files: ['apps/front/**/*.{ts,tsx}'],
    linterOptions: {
      // 本仓库大量使用 eslint-disable-next-line 压制“最佳实践”类规则。
      // 当规则升级/变化时，这些指令可能被标记为 unused 并导致 lint 失败。
      reportUnusedDisableDirectives: 'off',
    },
    rules: {
      // 这些规则大多是 DX/最佳实践告警，当前仓库对 front 采用“不中断 CI”策略。
      'react-refresh/only-export-components': 'off',
      'react-hooks/exhaustive-deps': 'off',
      'react-hooks-extra/no-direct-set-state-in-use-effect': 'off',
      'react-dom/no-missing-button-type': 'off',
      'react-web-api/no-leaked-event-listener': 'off',
      'react-web-api/no-leaked-timeout': 'off',
      'react/no-unstable-default-props': 'off',
    },
  },
  {
    files: ['apps/backend/src/**/*.ts'],
    rules: {
      'react/no-forward-ref': 'off',
      'react/no-useless-forward-ref': 'off',
      // backend (NestJS) 会大量使用 `useFactory` 作为 provider 配置字段，不应触发 hooks 前缀规则
      'react-hooks-extra/no-unnecessary-use-prefix': 'off',
      'unicorn/no-useless-spread': 'off',
      'unicorn/no-useless-undefined': 'off',
      'unicorn/no-useless-promise-resolve-reject': 'off',
      'unicorn/consistent-function-scoping': 'off',
      '@typescript-eslint/no-unnecessary-type-constraint': 'off',
    },
  },
  {
    files: [
      'packages/shared/src/constants/enums.ts',
      'packages/shared/src/generated/prisma-enums.ts',
    ],
    rules: {
      // const + type 同名是标准 TypeScript 枚举替代模式，不属于真正的重复声明
      'no-redeclare': 'off',
      'ts/no-redeclare': 'off',
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.test.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
    },
  },
  // 枚举 SSOT 防护：禁止从 prisma.types 或 generated/prisma 导入枚举（Refs: #533）
  {
    files: ['apps/**/*.ts', 'apps/**/*.tsx'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/prisma/prisma.types', '**/generated/prisma'],
          importNamePattern: prismaEnumPattern,
          message: '枚举必须从 @ai/shared 导入，不要从 prisma.types 或 generated/prisma 导入。参见 ruler/conventions.md 枚举 SSOT 约定。',
        }],
      }],
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // Issue #1279 AC-4: 阻断 atom key 字面量比较
  // 唯一真相源: ATOM_CONTRACT_REGISTRY；任何按 atom 分流的代码必须查注册表
  // Plugin: eslint-rules/no-atom-key-literal.js (flat config)
  //
  // 启用域: apps/quantify/src/modules/llm-strategy-codegen/**
  // 永久豁免:
  //   - atom-contract-registry.ts 自身（真相源）
  //   - constants/canonical-strategy-capabilities.ts（FIRST_WAVE 派生器）
  //   - utterance-corpus 目录（NL fixture）
  //   - 所有 .spec.ts / .e2e-spec.ts（测试可写 atom 字面量做断言）
  // PR2 ratchet allowlist（PR3a/3b/3c 逐文件清空）:
  //   - 命中文件清单见下方 ignores 列表
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: ['apps/quantify/src/modules/llm-strategy-codegen/**/*.ts'],
    ignores: [
      // 永久豁免
      'apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/**',
      'apps/quantify/src/modules/llm-strategy-codegen/constants/canonical-strategy-capabilities.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/**',
      'apps/quantify/src/modules/llm-strategy-codegen/**/*.spec.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/**/*.e2e-spec.ts',
      // 永久豁免：atom-key 真相源定义自身（semantic-atom-registry.service.ts）
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts',
      // PR3a ratchet（canonical IR compiler — 切到 emit.irShape 后移除）
      'apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts',
      // PR3b ratchet（conversation + spec-builder）已切到 REGISTRY/FIELD_KEY，PR3b 已移除
      // PR3c ratchet（22 服务文件 — batch 1-5 全部清零，本 PR 移除）
      // codegen-publication-generation.stage.ts: PR3c.9b batch 2 已清零
      // semantic-contract-readiness.service.ts: PR3c.9e batch 5 已清零
      // semantic-seed-state-builder.service.ts: PR3c.9e batch 5 已清零
      // semantic-state-merge.service.ts: PR3c.9b batch 2 已清零
      // semantic-state-normalization.ts: PR3c.9b batch 2 已清零
      // semantic-state-projection.service.ts: PR3c.9d batch 4 已清零
      // semantic-state-reducer.service.ts: PR3c.9c batch 3 已清零
      // semantic-support-classifier.service.ts: PR3c.9b batch 2 已清零
      // strategy-consistency.service.ts: PR3c.9d batch 4 已清零
      // strategy-intent-normalizer.service.ts: PR3c.9c batch 3 已清零
      // strategy-ir-canonical-adapter.service.ts: PR3c.9b batch 2 已清零
      // strategy-semantic-contracts.ts: PR3c.9d batch 4 已清零
      // strategy-summary-builder.service.ts: PR3c.9c batch 3 已清零
    ],
    plugins: {
      'atom-keys': {
        rules: {
          'no-atom-key-literal': noAtomKeyLiteral,
        },
      },
    },
    rules: {
      'atom-keys/no-atom-key-literal': 'error',
    },
  },
  // ─────────────────────────────────────────────────────────────────────────
  // Issue #1279 AC-13: 阻断 dispatcher 内业务规则 if/switch
  // 红线：入口（dispatcher）永远只读 ATOM_CONTRACT_REGISTRY，业务规则全部
  //       沉淀到 atom contract。dispatcher 不允许"一个策略一个 if"。
  // Plugin: eslint-rules/no-business-rule-in-dispatcher.js
  //
  // 启用域（PR2c-final-1bc 收敛）：
  //   apps/quantify/src/modules/llm-strategy-codegen/services/**/*.ts 全目录
  //   不只 dispatcher 单文件 —— 守门覆盖 service 层 helper / projection 等所有
  //   可能"一个策略一个 if"的位置，防止业务规则从 dispatcher 挪到隔壁 service
  //   绕过守门。
  //
  // 永久豁免:
  //   - atom-contract-registry.ts 自身（真相源，可显式枚举 bucket）
  //   - constants/ 派生器 + utterance-corpus（数据/fixture）
  //   - 所有 .spec.ts / .e2e-spec.ts（测试可比较 bucket 字面量做断言）
  //
  // PR3c ratchet allowlist（业务规则字面量历史遗留文件，持续消化中）：见下方 ignores
  //
  // Known limitation（review M2，文档化已知 bypass）：
  //   - identifier 重写绕过（`const k = 'trigger'; if (bucket === k)`）需要符号
  //     tracking 才能 catch，超出 ESLint flat plugin 单文件 AST 扫描能力，由 PR
  //     review 流程兜底
  // ─────────────────────────────────────────────────────────────────────────
  {
    files: [
      'apps/quantify/src/modules/llm-strategy-codegen/services/**/*.ts',
    ],
    ignores: [
      // 永久豁免
      'apps/quantify/src/modules/llm-strategy-codegen/services/**/*.spec.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/**/*.e2e-spec.ts',
      // PR3c ratchet（18 个文件 / 58 处 bucket 字面量比较 — 业务清零后移除）
      'apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-validator.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-response-mapper.helper.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-graph-snapshot.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/per-trade-sizing-resolver.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-graph-compiler.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-normalization.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/semantic-trigger-combination-contract.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/strategy-consistency.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/strategy-intent-resolution.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/strategy-semantic-contracts.ts',
    ],
    plugins: {
      dispatcher: {
        rules: {
          'no-business-rule-in-dispatcher': noBusinessRuleInDispatcher,
        },
      },
    },
    rules: {
      'dispatcher/no-business-rule-in-dispatcher': 'error',
    },
  },
)
