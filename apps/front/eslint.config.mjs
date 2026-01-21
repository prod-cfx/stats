// 使用项目根目录的统一 ESLint 配置（@antfu）
// 移除 eslint-config-next 以避免 @rushstack/eslint-patch 兼容性问题
export default [
  {
    name: 'workspace/ignores',
    ignores: [
      'node_modules',
      '.next',
      'dist',
      'build',
      '*.config.*',
      // TradingView Charting Library（第三方压缩产物，不参与 lint）
      'public/tradingview',
      'public/tradingview/**',
    ]
  }
]
