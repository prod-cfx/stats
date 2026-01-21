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
      'unicorn/number-literal-case': ['error', { hexadecimalValue: 'lowercase' }],
    },
  },
  {
    files: ['apps/front/**/*.{ts,tsx}', 'apps/admin-front/**/*.{ts,tsx}'],
    rules: {
      'react/no-forward-ref': 'off',
      'react/no-use-context': 'off',
      'react/no-context-provider': 'off',
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
    files: ['**/*.spec.ts', '**/*.e2e-spec.ts', '**/*.test.ts'],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
    },
  },
)

