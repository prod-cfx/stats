import antfu from '@antfu/eslint-config'

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
          importNames: [
            // --- backend enums ---
            'PrincipalType', 'AdminMenuType',
            'LiquidationHeatmapSource', 'LiquidationHeatmapModelType',
            'BackendMarketTimeframe', 'VenueType', 'BackendInstrumentType',
            'UserCredentialType', 'VerificationCodePurpose',
            'WhaleNotificationRuleType', 'WhaleNotificationChannel',
            'WhaleNotificationDeliveryStatus',
            // --- quantify enums ---
            'LlmStrategyStatus', 'LlmStrategyInstanceStatus',
            'LlmStrategyInstanceMode', 'LlmStrategyRunStatus',
            'LlmCodegenSessionStatus',
            'SymbolType', 'SymbolStatus',
            'QuantifyInstrumentType', 'IndicatorType', 'QuantifyMarketTimeframe',
            'OutboxStatus',
            'TradeSide', 'PositionSide', 'PositionStatus', 'LedgerEntryType',
            'SignalSourceType', 'SignalType', 'SignalDirection', 'SignalStatus',
            'ExecutionStatus',
            'StrategyTemplateStatus', 'StrategyInstanceStatus', 'StrategyInstanceMode',
            'SubscriptionStatus', 'ExchangeId',
            // --- raw Prisma enum names (codegen adds prefix, but originals still accessible) ---
            'MarketTimeframe', 'InstrumentType',
            // --- $Enums namespace (backdoor prevention) ---
            '$Enums',
          ],
          message: '枚举必须从 @ai/shared 导入，不要从 prisma.types 或 generated/prisma 导入。参见 ruler/conventions.md 枚举 SSOT 约定。',
        }],
      }],
    },
  },
)
