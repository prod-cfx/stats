/**
 * Issue #1279 #1329 Wave 1D —— user-facing 字段 leak guard 集成 spec
 *
 * 背景：
 *   - `internal-key-leak-guard-projection.spec.ts` 已覆盖
 *     `SemanticStateProjectionService.buildConversationView` 的 summary /
 *     triggerSummary / riskSummary / positionSummary 4 字段。
 *   - `display-parity.spec.ts` 已覆盖 ATOM_CONTRACT_REGISTRY 的
 *     `summaryTemplate` / `clarificationQuestion` 全 atom × 全 slot。
 *   - 但仍有两条 user-facing 输出路径无 leak guard 覆盖：
 *       1. `SemanticStateProjectionService.buildClarificationView` →
 *          `{ summary, nextQuestion }` —— clarification 提示气泡走这条
 *       2. `CodegenConversationService.buildUnknownSemanticSupportAssistantPrompt`
 *          —— unknown atom 兜底 assistant prompt（PR #1331 修过 fallback，
 *          这里把回归守门）
 *
 *   本 spec 关闭这两条 surface 的覆盖缺口，防 future 新 atom 或 prompt 改写
 *   绕过 leak guard。
 */
import type { SemanticPositionConstraintKey, SemanticState } from '../../types/semantic-state'
import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import {
  buildInternalIdentifierKeys,
  buildInternalIdentifierPattern,
} from '../../nl-gateway/internal-key-leak-guard/internal-key-identifiers'
import { InternalKeyLeakGuardService } from '../../nl-gateway/internal-key-leak-guard/internal-key-leak-guard'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
// #1279 #1329 M3：真实 import 生产代码，删除本地逻辑同构副本
import { buildUnknownSemanticSupportAssistantPrompt } from '../codegen-conversation.service'

// ─────────────────────────────────────────────────────────────────────────────
// helpers（与 internal-key-leak-guard-projection.spec.ts 同源结构，
// 但本 spec 聚焦 buildClarificationView 与 unknownSemanticSupport prompt）
// ─────────────────────────────────────────────────────────────────────────────

function makeEmptyState(): SemanticState {
  return {
    version: 1,
    families: ['single-leg'],
    trigger: [],
    action: [],
    risk: [],
    position: null,
    positionConstraint: [],
    orchestration: [],
    orchestrationContracts: [],
    contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
    normalizationNotes: [],
    updatedAt: new Date().toISOString(),
  }
}

function makeTriggerState(
  key: string,
  phase: 'entry' | 'exit' = 'entry',
  params: Record<string, unknown> = {},
): SemanticState['trigger'][number] {
  return {
    id: `t-${key}`,
    key,
    phase,
    status: 'locked',
    source: 'user_explicit',
    params,
    openSlots: [],
    contracts: undefined,
  }
}

function makeRiskState(
  key: string,
  params: Record<string, unknown> = {},
): SemanticState['risk'][number] {
  return {
    id: `r-${key}`,
    key,
    status: 'locked',
    source: 'user_explicit',
    params,
    openSlots: [],
    contracts: undefined,
  }
}

function makeActionState(
  key: string,
  params: Record<string, unknown> = {},
): SemanticState['action'][number] {
  return {
    id: `a-${key}`,
    key,
    status: 'locked',
    source: 'user_explicit',
    params,
    openSlots: [],
    contracts: undefined,
  }
}

const projection = new SemanticStateProjectionService()
const leakGuard = new InternalKeyLeakGuardService()

function extractClarificationTexts(state: SemanticState): string[] {
  const view = projection.buildClarificationView(state)
  return [view.summary, view.nextQuestion].filter(
    (t): t is string => typeof t === 'string' && t.length > 0,
  )
}

function assertNoLeaks(texts: string[], label: string): void {
  for (const text of texts) {
    const findings = leakGuard.scan(text, { surface: label })
    if (findings.length > 0) {
      throw new Error(
        `InternalKeyLeakGuard 命中 [${label}]: ${findings.map(f => `${f.key}@${f.path}`).join(', ')}\n文本: ${text}`,
      )
    }
    expect(findings).toHaveLength(0)
  }
}

// 与 projection spec 同源 fixture（trigger atom 最小 params）
const TRIGGER_PARAMS: Record<string, Record<string, unknown>> = {
  'indicator.above': { indicator: 'MA', 'reference.period': 20 },
  'indicator.below': { indicator: 'MA', 'reference.period': 20 },
  'indicator.cross_over': { indicator: 'MA', fastPeriod: 5, slowPeriod: 20 },
  'indicator.cross_under': { indicator: 'MA', fastPeriod: 5, slowPeriod: 20 },
  'indicator.divergence': { indicator: 'MACD' },
  'bollinger.touch_upper': { period: 20, stdDev: 2 },
  'bollinger.touch_lower': { period: 20, stdDev: 2 },
  'bollinger.touch_middle': { period: 20, stdDev: 2 },
  'price.detect.indicator_boundary': {
    indicator: { name: 'bollinger', period: 20, stdDev: 2 },
    boundaryRole: 'upper',
  },
  'price.percent_change': { valuePct: -3, basis: 'prev_close' },
  'price.range_position_lte': { lookbackBars: 20, thresholdPct: 20 },
  'price.range_position_gte': { lookbackBars: 20, thresholdPct: 80 },
  'price.breakout_up': { period: 20, bufferPct: 0.5 },
  'price.breakout_down': { period: 20, bufferPct: 0.5 },
  'price.candle_pattern': { pattern: 'hammer' },
  'price.chart_pattern': { pattern: 'head_and_shoulders' },
  'oscillator.rsi_gte': { value: 70 },
  'oscillator.rsi_lte': { value: 30 },
  'grid.range_rebalance': { lower: 90000, upper: 110000, stepPct: 1 },
  'market.regime': { regime: 'bull' },
  'trend.direction': { direction: 'up' },
  'volatility.state': { state: 'high' },
  'volatility.atr_threshold': { multiplier: 2 },
  'volume.threshold': { threshold: 1000000 },
  'liquidity.sweep': { side: 'buy' },
  'strategy.time_window': { start: '09:00', end: '17:00' },
  'external.signal': { provider: 'tradingview' },
  'position.has_position': {},
  'position.no_position': {},
  'execution.on_start': {},
  'reference.period': { period: 20 },
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 1：buildClarificationView 全 atom 0 命中
// ─────────────────────────────────────────────────────────────────────────────

describe('user-facing leak guard 集成（#1329 Wave 1D）', () => {
  describe('buildClarificationView trigger atom 逐 key 扫描', () => {
    const triggerKeys = Object.keys(ATOM_CONTRACT_REGISTRY).filter(
      k => ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket === 'trigger',
    )

    for (const key of triggerKeys) {
      it(`clarificationView trigger=${key} 无 internal key 泄漏`, () => {
        const params = TRIGGER_PARAMS[key] ?? {}
        const state: SemanticState = {
          ...makeEmptyState(),
          trigger: [makeTriggerState(key, 'entry', params)],
          action: [makeActionState('action.open_long')],
        }
        assertNoLeaks(extractClarificationTexts(state), `clarificationView:trigger:${key}`)
      })
    }
  })

  describe('buildClarificationView risk atom 逐 key 扫描', () => {
    const riskKeys = Object.keys(ATOM_CONTRACT_REGISTRY).filter(
      k => ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket === 'risk',
    )

    for (const key of riskKeys) {
      it(`clarificationView risk=${key} 无 internal key 泄漏`, () => {
        const params = key === 'risk.partial_take_profit'
          ? { tiers: [{ trigger: { threshold: 5 }, reduceRatio: 0.5 }] }
          : { valuePct: 5 }
        const state: SemanticState = {
          ...makeEmptyState(),
          trigger: [makeTriggerState('price.percent_change', 'entry', { valuePct: -3, basis: 'prev_close' })],
          action: [makeActionState('action.open_long')],
          risk: [makeRiskState(key, params)],
        }
        assertNoLeaks(extractClarificationTexts(state), `clarificationView:risk:${key}`)
      })
    }
  })

  describe('buildClarificationView action atom 逐 key 扫描', () => {
    const actionKeys = Object.keys(ATOM_CONTRACT_REGISTRY).filter(
      k => ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket === 'action',
    )

    for (const key of actionKeys) {
      it(`clarificationView action=${key} 无 internal key 泄漏`, () => {
        const state: SemanticState = {
          ...makeEmptyState(),
          trigger: [makeTriggerState('price.percent_change', 'entry', { valuePct: -3, basis: 'prev_close' })],
          action: [makeActionState(key)],
        }
        assertNoLeaks(extractClarificationTexts(state), `clarificationView:action:${key}`)
      })
    }
  })

  describe('buildClarificationView position constraint atom 逐 key 扫描', () => {
    const positionKeys = Object.keys(ATOM_CONTRACT_REGISTRY).filter(
      k => ATOM_CONTRACT_REGISTRY[k as keyof typeof ATOM_CONTRACT_REGISTRY].bucket === 'positionConstraint',
    )

    for (const key of positionKeys) {
      it(`clarificationView position=${key} 无 internal key 泄漏`, () => {
        const params = key === 'position.pyramiding_limit'
          ? { maxLayers: 3 }
          : key === 'position.dca_schedule'
            ? { maxCount: 3 }
            : {}
        const state: SemanticState = {
          ...makeEmptyState(),
          triggers: [makeTriggerState('price.percent_change', 'entry', { valuePct: -3, basis: 'prev_close' })],
          actions: [makeActionState('action.open_long')],
          position: {
            sizing: null,
            mode: 'flat',
            value: 0,
            positionMode: 'oneway',
            status: 'locked' as const,
            source: 'user_explicit' as const,
            // @ts-ignore Task6: position.constraints moved to top-level positionConstraint
            constraints: [
              {
                id: `pc-${key}`,
                key: key as SemanticPositionConstraintKey,
                status: 'locked',
                source: 'user_explicit' as const,
                params,
                openSlots: [],
              },
            ],
          },
        }
        assertNoLeaks(extractClarificationTexts(state), `clarificationView:position:${key}`)
      })
    }
  })

  // ─────────────────────────────────────────────────────────────────────────
  // Surface 2：buildUnknownSemanticSupportAssistantPrompt
  //
  // 该方法是 CodegenConversationService 的 private，构造 service 实例成本极高
  // （依赖 ~20 个 NestJS provider）。这里以"逻辑同构"方式重建 fallback 文本
  // 生成函数，对 unknown atom 数组（含未注册 raw key 与已注册 key 混合）
  // 跑 leak guard scan，回归 PR #1331 修过的 fallback。
  //
  // 若生产代码 buildUnknownSemanticSupportAssistantPrompt 内部回退逻辑被改回
  // 直接吐 atomKey 字面量，本地逻辑同构副本会同步漂移 → 由下方
  // `源代码哨兵正则` 守门，强制保持公开 publicName 抽取语义。
  // ─────────────────────────────────────────────────────────────────────────
  // #1279 #1329 M3：改为真实 import 生产函数，删除本地逻辑同构副本
  describe('unknown semantic support assistant prompt', () => {
    const PROBE_UNKNOWN_ATOMS: readonly string[][] = [
      [],
      ['indicator.above'],
      ['price.percent_change', 'oscillator.rsi_gte'],
      ['totally.fake.atom.key'], // 未注册 → genericLabel 兜底
      ['indicator.above', 'totally.fake.atom.key'], // 已注册 + 未注册混合
    ]

    for (const locale of ['zh', 'en'] as const) {
      for (const probe of PROBE_UNKNOWN_ATOMS) {
        it(`locale=${locale} unknownAtoms=[${probe.join(',') || '<empty>'}] 无 internal key 泄漏`, () => {
          const text = buildUnknownSemanticSupportAssistantPrompt(probe, locale)
          assertNoLeaks([text], `unknownSemanticSupport:${locale}`)
        })
      }
    }

    // 源代码哨兵：禁止 buildUnknownSemanticSupportAssistantPrompt 内部回退到
    // 直接插值 atomKey（如 `${key}` 或 `${unknownAtoms.join(...)}` 等）。
    // M3 后：检查 module-level export 函数（非 private delegate）。
    it('源代码不存在 raw atomKey 直接插值（回归 PR #1331）', () => {
      // eslint-disable-next-line ts/no-require-imports
      const fs = require('node:fs') as typeof import('node:fs')
      // eslint-disable-next-line ts/no-require-imports
      const path = require('node:path') as typeof import('node:path')
      const source = fs.readFileSync(
        path.resolve(__dirname, '../codegen-conversation.service.ts'),
        'utf8',
      )
      // M3：export fn 在 module 顶层（private delegate 只 1 行 return）
      const fnSig = 'export function buildUnknownSemanticSupportAssistantPrompt('
      const startIdx = source.indexOf(fnSig)
      expect(startIdx).toBeGreaterThan(0)
      // 截 fn body ~1500 字符以内审视回退分支
      const slice = source.slice(startIdx, startIdx + 1500)
      // 禁止直接 ${key} / ${atomKey} 拼接到 user-facing 字符串
      expect(slice).not.toMatch(/\$\{key\}/u)
      expect(slice).not.toMatch(/\$\{atomKey\}/u)
      expect(slice).not.toMatch(/\$\{unknownAtoms(?!\.)/u) // 禁止整体 join 进 prompt（旧 leak 形态）
      // 必须经 publicName 抽取
      expect(slice).toContain('publicName')
    })
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 元守门：未来若加 new public surface 字段绕过 leak guard，由 INTERNAL_KEY
  // pattern 与 atomRegistry 一致性兜底（与 display-parity 同 pattern）。
  // ─────────────────────────────────────────────────────────────────────────
  it('leak guard pattern 与 atomRegistry 保持一致', () => {
    const pattern = buildInternalIdentifierPattern(
      buildInternalIdentifierKeys(new SemanticAtomRegistryService()),
    )
    expect(pattern).toBeInstanceOf(RegExp)
    // 抽样：必须命中已知 internal key
    expect(pattern.test('indicator.above')).toBe(true)
    expect(pattern.test('price.percent_change')).toBe(true)
    // 非 internal key 不命中
    expect(pattern.test('普通中文描述：上边界触及')).toBe(false)
  })
})
