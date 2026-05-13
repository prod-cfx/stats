/**
 * display-parity 哨兵（Task 3c.7 删 service 后结构守门）（Issue #1279 PR3c）
 *
 * 哨兵语义：
 *   Task 3c.7 删除 `semantic-presentation-registry.service.ts`（已 git mv 为
 *   `legacy-presentation-data.ts`，class 壳将在 3c.7d 删除）之后，本 spec
 *   断言 `ATOM_CONTRACT_REGISTRY` 具备**自洽的 display / clarification 输出能力**：
 *
 *     1. summaryTemplate(params, 'zh') 返回非空字串
 *     2. clarificationQuestion(slotKey, params, 'zh') 对所有 surface.paramSlots 返回非空字串
 *     3. 输出**不含**任何 internal atom-key 字面量（AC-9 leak 红线）
 *
 *   BYTE_EQUIVALENCE 段（service vs registry 字节相等断言）已在 3c.7c 删除，
 *   因 service class 壳即将在 3c.7d 移除，对比基准不再存在。
 */

import { ATOM_CONTRACT_REGISTRY } from '../atom-contract-registry'
import { type AtomContractKey } from '../atom-contract-types'
import {
  buildInternalIdentifierKeys,
  buildInternalIdentifierPattern,
} from '../../nl-gateway/internal-key-leak-guard/internal-key-identifiers'
import { SemanticAtomRegistryService } from '../../services/semantic-atom-registry.service'

// 内部 atom key 泄漏识别 pattern（AC-9 红线）——由 SemanticAtomRegistryService +
// buildInternalIdentifierPattern 驱动，与 InternalKeyLeakGuardService 完全一致，
// 消除手工复制的 regex 漂移风险。
const INTERNAL_KEY_LEAK_PATTERN: RegExp = buildInternalIdentifierPattern(
  buildInternalIdentifierKeys(new SemanticAtomRegistryService()),
)

/**
 * 每个 atom 一组代表性 params。
 * 未列出的 atom 默认使用 `{}`。
 */
const FIXTURE: Partial<Record<AtomContractKey, Record<string, unknown>>> = {
  'volume.threshold': { metric: 'base_volume', operator: 'GT', value: 1000 },
  'volatility.atr_threshold': { operator: 'GT', period: 14, threshold: 50 },
  'price.candle_pattern': { pattern: 'engulfing', direction: 'bullish' },
  'price.chart_pattern': { pattern: 'head_and_shoulders', direction: 'bearish' },
  'liquidity.sweep': { direction: 'bullish', reference: 'prev_low', reclaimBars: 3 },
  'external.signal': { provider: 'tradingview' },
  'position.has_position': { sideScope: 'long' },
  'position.no_position': { sideScope: 'long' },
  'portfolioRisk.drawdown_block': { mode: 'enforce', thresholdPct: 10 },
  'position.dca_schedule': { triggerMode: 'price_interval', maxCount: 3 },
}

function assertLeakFree(atomKey: AtomContractKey, text: string, where: string): void {
  if (INTERNAL_KEY_LEAK_PATTERN.test(text)) {
    throw new Error(`[display-parity leak] ${atomKey} ${where} 输出泄漏 internal atom key: "${text}"`)
  }
}

describe('display-parity 哨兵（Task 3c.7 删 service 后结构守门）', () => {
  const allAtomKeys = Object.keys(ATOM_CONTRACT_REGISTRY) as AtomContractKey[]

  describe('结构对等 + leak-free（全 atom）', () => {
    it.each(allAtomKeys)(
      'summaryTemplate(zh) 返回非空 + 无 internal-key leak：%s',
      (atomKey) => {
        const contract = ATOM_CONTRACT_REGISTRY[atomKey]
        const params = FIXTURE[atomKey] ?? {}
        const output = contract.display.summaryTemplate(params, 'zh')

        expect(typeof output).toBe('string')
        expect(output.length).toBeGreaterThan(0)
        assertLeakFree(atomKey, output, 'summaryTemplate')
      },
    )

    it.each(allAtomKeys)(
      'clarificationQuestion(zh) 返回非空 + 无 internal-key leak：%s',
      (atomKey) => {
        const contract = ATOM_CONTRACT_REGISTRY[atomKey]
        const params = FIXTURE[atomKey] ?? {}

        // Task 3c.5 完成后所有 atom 的 clarificationQuestion 都是真函数，
        // VIA_PRESENTATION_DISPLAY symbol 已不存在；编译期由类型 narrowing 守门。
        const slotKeys = Object.keys(contract.surface.paramSlots ?? {}).map(slot => `${atomKey}.${slot}`)
        const probeSlots = slotKeys.length > 0 ? slotKeys : ['<unknown-slot>']

        for (const slotKey of probeSlots) {
          const output = contract.clarificationQuestion(slotKey, params, 'zh')
          expect(typeof output).toBe('string')
          expect(output.length).toBeGreaterThan(0)
          assertLeakFree(atomKey, output, `clarificationQuestion(${slotKey})`)
        }
      },
    )
  })
})
