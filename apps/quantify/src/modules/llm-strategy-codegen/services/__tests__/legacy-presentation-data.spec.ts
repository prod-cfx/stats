import { ATOM_CONTRACT_REGISTRY } from '../../atom-contracts/atom-contract-registry'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import {
  getLegacyEntry,
  hasExplicitLegacyDisplayRenderer,
  renderLegacyClarification,
  renderLegacyDisplay,
} from '../legacy-presentation-data'
import { getDisplayToken, listDisplayTokens, renderDisplayToken } from '../../nl-gateway/display-registry'

// #1364 AC-4: orchestration bucket atoms 由 SemanticOrchestrationRegistryService
// 单独管理 presentation/clarification 渲染，不走 legacy-presentation-data 通道；
// 这里在 list() 出口侧过滤掉它们，避免对未注册的 legacy entry 误检。
function isOrchestrationAtom(key: string): boolean {
  const entry = (ATOM_CONTRACT_REGISTRY as Record<string, { bucket?: string }>)[key]
  return entry?.bucket === 'orchestration'
}

describe('legacy-presentation-data (transition pure helpers)', () => {
  const atomRegistry = new SemanticAtomRegistryService()

  it('has presentation metadata and contract completion fields for every supported atom', () => {
    const supportedAtoms = atomRegistry.list()
      .filter(atom => atom.supportStatus.startsWith('supported_'))
      .filter(atom => !isOrchestrationAtom(atom.key))

    expect(supportedAtoms.length).toBeGreaterThan(0)

    for (const supportedAtom of supportedAtoms) {
      const key = supportedAtom.key
      expect(supportedAtom.supportStatus).toMatch(/^supported_/u)
      expect(supportedAtom.contractSubstrate).toEqual(expect.objectContaining({
        runtimeRequirements: expect.any(Array),
        stateRequirements: expect.any(Array),
        orderRequirements: expect.any(Array),
        openSlots: expect.any(Array),
      }))
      expect(supportedAtom.executableProjection.length).toBeGreaterThan(0)
      expect(getDisplayToken(`atom.${key}.name`)).toEqual(expect.objectContaining({
        kind: 'atom',
        zh: expect.any(String),
      }))
      const entry = getLegacyEntry(key)
      expect(entry).toBeDefined()
      expect(entry).toEqual(expect.objectContaining({
        key,
        publicName: expect.any(String),
        aliases: expect.arrayContaining([expect.any(String)]),
        positiveExamples: expect.arrayContaining([expect.any(String)]),
        negativeExamples: expect.arrayContaining([expect.any(String)]),
        goldenUtterances: expect.arrayContaining([expect.any(String)]),
        displayRenderer: expect.any(Function),
        clarificationRenderer: expect.any(Function),
      }))
    }
  })

  it('rejects missing presentation metadata instead of generating supported fallbacks', () => {
    const entry = getLegacyEntry('market.trend')
    expect(entry).toBeUndefined()
  })

  it('provides display tokens across atom, param, enum, and slot categories', () => {
    expect(listDisplayTokens().length).toBeGreaterThanOrEqual(80)
    expect(listDisplayTokens('atom').length).toBeGreaterThan(0)
    expect(listDisplayTokens('param').length).toBeGreaterThan(0)
    expect(listDisplayTokens('enum').length).toBeGreaterThan(0)
    expect(listDisplayTokens('slot').length).toBeGreaterThan(0)

    for (const atomKey of atomRegistry.list()
      .filter(atom => atom.supportStatus.startsWith('supported_'))
      .filter(atom => !isOrchestrationAtom(atom.key))
      .map(atom => atom.key)) {
      expect(getDisplayToken(`atom.${atomKey}.name`)).toEqual(expect.objectContaining({
        kind: 'atom',
        zh: expect.any(String),
      }))
    }
  })

  it('rejects display token template drift when placeholder values are missing', () => {
    expectSemanticTokenNotFound(
      () => renderDisplayToken('atom.condition.expression.display'),
      'atom.condition.expression.display.label',
    )
    expectSemanticTokenNotFound(
      () => renderDisplayToken('atom.volume.threshold.display', { metric: '成交量', operator: '大于' }),
      'atom.volume.threshold.display.value',
    )
  })

  it('keeps presentation metadata free of internal atom identifiers', () => {
    const internalKeys = atomRegistry.list().map(atom => atom.key)
    const internalPattern = new RegExp(
      `(^|[^A-Za-z0-9_.])(?:${internalKeys.map(escapeRegExp).join('|')}|generic_boundary)(?=$|[^A-Za-z0-9_])`,
      'u',
    )

    for (const supportedAtom of atomRegistry.list()
      .filter(atom => atom.supportStatus.startsWith('supported_'))
      .filter(atom => !isOrchestrationAtom(atom.key))) {
      const entry = getLegacyEntry(supportedAtom.key)
      expect(entry).toBeDefined()
      const metadata = entry!
      const publicText = [
        metadata.publicName,
        ...metadata.aliases,
        ...metadata.positiveExamples,
        ...metadata.negativeExamples,
        ...metadata.goldenUtterances,
      ].join('\n')

      expect(publicText).not.toMatch(internalPattern)
    }
  })

  it('formats BOLL and EMA semantics without leaking internal keys', () => {
    const bollText = renderLegacyDisplay('price.detect.indicator_boundary', {
      indicator: { name: 'bollinger', period: 20, stdDev: 2 },
      boundaryRole: 'lower',
      confirmationMode: 'touch',
    })
    const emaText = renderLegacyDisplay('condition.expression', {
      label: '价格同时位于 EMA20、EMA60、EMA144 上方',
    })

    // PR3c.5 REGISTRY summaryTemplate 文案统一，与 service 渲染语序微差但语义等价
    expect(bollText).toBe('触及 BOLL（20, 2）下轨')
    expect(emaText).toBe('价格同时位于 EMA20、EMA60、EMA144 上方')
    expect(`${bollText} ${emaText}`).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)
  })

  it('formats fixed percent position values as either ratios or percents', () => {
    expect(renderLegacyDisplay('position.fixed_pct', { value: 0.1 })).toBe('单笔 10% 仓位')
    expect(renderLegacyDisplay('position.fixed_pct', { value: 10 })).toBe('单笔 10% 仓位')
  })

  it('rejects display output that contains P0 internal identifiers', () => {
    expect(() => renderLegacyDisplay('condition.expression', {
      label: 'risk.stop_loss_pct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => renderLegacyDisplay('condition.expression', {
      label: 'position.fixed_pct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => renderLegacyDisplay('condition.expression', {
      label: 'open_long',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
  })

  it('rejects display output that contains compound internal slot paths', () => {
    expect(() => renderLegacyDisplay('condition.expression', {
      label: 'risk.stop_loss_pct.valuePct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => renderLegacyDisplay('condition.expression', {
      label: 'position.fixed_pct.value',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
  })

  it('gracefully degrades unknown enum values via REGISTRY summaryTemplate (no throw, returns string)', () => {
    // PR3c.5：4 个 atom 均已迁入 REGISTRY，summaryTemplate 对 unknown enum 值 graceful fallback（原值字符串），不再 throw
    // PRESENTATIONS 路径会调用 renderEnumDisplayToken 进而 throw，但 REGISTRY-first 命中后不走该路径
    const dcaText = renderLegacyDisplay('position.dca_schedule', { triggerMode: 'triggerMode', maxCount: 3 })
    expect(typeof dcaText).toBe('string')
    expect(dcaText.length).toBeGreaterThan(0)
    // unknown triggerMode 值原样出现（graceful）；不含 atom internal key
    expect(dcaText).not.toContain('position.dca_schedule')

    const candleText = renderLegacyDisplay('price.candle_pattern', { pattern: 'bearish_engulfing', direction: 'bullish' })
    expect(typeof candleText).toBe('string')
    expect(candleText.length).toBeGreaterThan(0)
    expect(candleText).not.toContain('price.candle_pattern')

    const sweepText = renderLegacyDisplay('liquidity.sweep', { direction: 'bullish', reference: 'raw_session_pivot' })
    expect(typeof sweepText).toBe('string')
    expect(sweepText.length).toBeGreaterThan(0)
    expect(sweepText).not.toContain('liquidity.sweep')

    const signalText = renderLegacyDisplay('external.signal', { provider: 'raw_provider' })
    expect(typeof signalText).toBe('string')
    expect(signalText.length).toBeGreaterThan(0)
    expect(signalText).not.toContain('external.signal')
  })

  // #1329 follow-up Phase 3c: gate.regime PRESENTATIONS entry 已迁入 ATOM_CONTRACT_REGISTRY.display；
  //   renderLegacyDisplay / renderLegacyClarification 仍是入口（REGISTRY-first），渲染契约由
  //   atom-coverage-full-registration.spec.ts + orchestration-gate-regime-golden-corpus.spec.ts 覆盖。

  // #1329 follow-up Phase 3d: portfolioRisk.drawdown_block 已迁入 ATOM_CONTRACT_REGISTRY.display；
  //   getLegacyEntry 不再返回该 atom（PRESENTATIONS 已删）。
  //   渲染契约通过 renderLegacyDisplay REGISTRY-first 路径验证。
  describe('portfolioRisk.drawdown_block entry', () => {
    it('getLegacyEntry returns undefined (entry moved to REGISTRY)', () => {
      const entry = getLegacyEntry('portfolioRisk.drawdown_block')
      expect(entry).toBeUndefined()
    })

    it('renders enforce-mode display string without leaking internal keys (REGISTRY-first)', () => {
      const text = renderLegacyDisplay('portfolioRisk.drawdown_block', { thresholdPct: 10, mode: 'enforce' })
      expect(text).toContain('10')
      expect(text).toContain('阻止')
      expect(text).toContain('账户')
      expect(text).not.toContain('portfolioRisk.drawdown_block')
      expect(text).not.toContain('orchestration')
      expect(text).not.toContain('block_new_entries')
      expect(text).not.toContain('drawdown_block')
      expect(text).not.toContain('enforce')
      expect(text).not.toContain('observe')
    })

    it('renders observe-mode display string without leaking internal keys (REGISTRY-first)', () => {
      const text = renderLegacyDisplay('portfolioRisk.drawdown_block', { thresholdPct: 5, mode: 'observe' })
      expect(text).toContain('5')
      expect(text).toContain('记录')
      expect(text).not.toContain('portfolioRisk.drawdown_block')
      expect(text).not.toContain('orchestration')
      expect(text).not.toContain('block_new_entries')
      expect(text).not.toContain('drawdown_block')
      expect(text).not.toContain('enforce')
      expect(text).not.toContain('observe')
    })

    it('renders clarification text containing 回撤 and 阈值 (REGISTRY-first)', () => {
      const text = renderLegacyClarification('portfolioRisk.drawdown_block', 'orchestration.portfolio_drawdown.threshold_pct', {})
      expect(text).toContain('回撤')
      expect(text).toContain('阈值')
    })
  })

  // #1329 follow-up Phase 3c: program.fixed_grid_gated / program.adaptive_volatility_grid
  //   PRESENTATIONS entry 已迁入 ATOM_CONTRACT_REGISTRY.display；
  //   渲染契约由对应 orchestration-*-golden-corpus.spec.ts 通过
  //   renderLegacyDisplay（REGISTRY-first）覆盖。

  it('renders clarification text without leaking raw slot keys', () => {
    const text = renderLegacyClarification('risk.stop_loss_pct', 'risk.stop_loss_pct.valuePct', {})

    expect(text).toBe('请补充百分比止损的止损比例。')
    expect(text).not.toContain('risk.stop_loss_pct.valuePct')
    expect(text).not.toContain('valuePct')
  })
})

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

function expectSemanticTokenNotFound(action: () => unknown, token: string): void {
  try {
    action()
    throw new Error('expected semantic token not found')
  }
  catch (err) {
    expect((err as { args?: { token?: string } }).args?.token).toBe(token)
    expect((err as Error).message).toBe('Semantic presentation token not found in registry')
    expect((err as Error).message).not.toContain(token)
  }
}
