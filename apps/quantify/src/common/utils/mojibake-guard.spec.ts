import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const repoRoot = join(__dirname, '../../..')

const knownMojibakeByFile: Record<string, string[]> = {
  'e2e/fixtures/fixtures.ts': [
    'API鍓嶇紑',
    '鍒涘缓娴嬭瘯搴旂敤',
  ],
  'src/common/services/cache.service.ts': [
    '娓呯┖缂撳瓨',
    '缂撳瓨涓嶅瓨鍦ㄦ椂鎵ц鍥炶皟',
  ],
  'prisma/schema/user_auth.prisma': [
    '鐢ㄦ埛涓庤璇佺浉鍏虫ā鍨',
  ],
  'prisma/schema/strategy_trading.prisma': [
    '鍘嗗彶鍥炴祴',
    '鍙€夛紝鐢ㄤ簬鏃х瓥鐣ユā鏉',
  ],
  'prisma/schema.prisma': [
    '鎵€鏈夋ā鍨',
  ],
  'src/modules/trading/exchanges/README_HYPERLIQUID.md': [
    '甯備环鍗曟ā鎷',
  ],
  'src/modules/strategy-instances/repositories/strategy-instances.repository.ts': [
    '鍙叕寮€ live',
  ],
  'src/modules/strategy-instances/services/strategy-instance-stats.service.ts': [
    '閫氳繃 strategyId',
  ],
  'src/modules/market-data/README.md': [
    '鏈ā鍧楄礋璐ｉ噰闆',
  ],
  'src/modules/strategy-signals/repositories/strategy-signal-state.repository.ts': [
    '获取实例对应的模板ID',
  ],
  'src/modules/strategy-signals/README_DEBUG.md': [
    '鏈ā鍧楁彁渚涗簡璇︾粏鐨勮剼鏈皟璇',
  ],
  'src/modules/ai/llm-v3-tools.executor.ts': [
    '鍥為€€鍒版棫鐨勭瓥鐣ユā鏉跨郴缁',
    '浼樺厛浣跨敤瀹炰緥绾у埆閰嶇疆',
  ],
  'src/modules/ai/providers/llm-provider-adapter.interface.ts': [
    '鐢变笂灞傛ā鍧楋紙濡',
  ],
  'src/modules/llm-strategies/REVIEW_FIXES.md': [
    '淇鎬荤粨',
  ],
  'src/modules/llm-strategies/README_SIGNAL_INTEGRATION.md': [
    'LLM绛栫暐淇″彿闆嗘垚鍒板紑浠撴祦绋',
  ],
  'src/main.ts': [
    '閰嶇疆鍏ㄥ眬楠岃瘉绠￠亾',
    '璁剧疆鍏ㄥ眬璺敱鍓嶇紑',
  ],
  'src/modules/backtesting/backtesting.controller.ts': [
    'Nest DI 闇€瑕佽繍琛屾椂寮曠敤',
  ],
  'src/modules/backtesting/core/backtest-runner.service.ts': [
    'Nest DI 闇€瑕佽繍琛屾椂寮曠敤',
  ],
  'src/modules/llm-strategies/services/llm-strategy-runs.service.ts': [
    '闇€瑕佺敤浜庝緷璧栨敞鍏ワ紝涓嶈兘浣跨敤 import type',
  ],
  'src/modules/llm-strategy-codegen/repositories/codegen-sessions.repository.ts': [
    'Nest DI 闇€瑕佽繍琛屾椂瀵煎叆',
  ],
  'src/modules/positions/positions-valuation.service.ts': [
    'Nest DI 闇€瑕佽繍琛屾椂寮曠敤',
    'Prisma 7: 浠?Prisma namespace 瀵煎嚭绫诲瀷鍜屽€?',
  ],
}

describe('quantify mojibake guard', () => {
  it('keeps known broken strings out of the quantify module', () => {
    for (const [relativePath, brokenSnippets] of Object.entries(knownMojibakeByFile)) {
      const content = readFileSync(join(repoRoot, relativePath), 'utf8')

      for (const brokenSnippet of brokenSnippets) {
        expect(content).not.toContain(brokenSnippet)
      }
    }
  })
})
