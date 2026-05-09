import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'
import { getDisplayToken, listDisplayTokens, renderDisplayToken } from '../../nl-gateway/display-registry'

describe('SemanticPresentationRegistryService', () => {
  const atomRegistry = new SemanticAtomRegistryService()
  const presentation = new SemanticPresentationRegistryService(atomRegistry)

  it('has presentation metadata and contract completion fields for every supported atom', () => {
    const supportedAtoms = atomRegistry.list().filter(atom => atom.supportStatus.startsWith('supported_'))

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
      expect(presentation.get(key)).toEqual(expect.objectContaining({
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
    try {
      presentation.get('market.trend')
      throw new Error('expected throw')
    }
    catch (err) {
      expect((err as { args?: { token?: string } }).args?.token).toBe('market.trend')
    }
  })

  it('provides display tokens across atom, param, enum, and slot categories', () => {
    expect(listDisplayTokens().length).toBeGreaterThanOrEqual(80)
    expect(listDisplayTokens('atom').length).toBeGreaterThan(0)
    expect(listDisplayTokens('param').length).toBeGreaterThan(0)
    expect(listDisplayTokens('enum').length).toBeGreaterThan(0)
    expect(listDisplayTokens('slot').length).toBeGreaterThan(0)

    for (const atomKey of atomRegistry.list().filter(atom => atom.supportStatus.startsWith('supported_')).map(atom => atom.key)) {
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

    for (const supportedAtom of atomRegistry.list().filter(atom => atom.supportStatus.startsWith('supported_'))) {
      const metadata = presentation.get(supportedAtom.key)
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
    const bollText = presentation.renderDisplay('price.detect.indicator_boundary', {
      indicator: { name: 'bollinger', period: 20, stdDev: 2 },
      boundaryRole: 'lower',
      confirmationMode: 'touch',
    })
    const emaText = presentation.renderDisplay('condition.expression', {
      label: '价格同时位于 EMA20、EMA60、EMA144 上方',
    })

    expect(bollText).toBe('触及 BOLL 下轨（20, 2）')
    expect(emaText).toBe('价格同时位于 EMA20、EMA60、EMA144 上方')
    expect(`${bollText} ${emaText}`).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)
  })

  it('formats fixed percent position values as either ratios or percents', () => {
    expect(presentation.renderDisplay('position.fixed_pct', { value: 0.1 })).toBe('单笔 10% 仓位')
    expect(presentation.renderDisplay('position.fixed_pct', { value: 10 })).toBe('单笔 10% 仓位')
  })

  it('rejects display output that contains P0 internal identifiers', () => {
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'risk.stop_loss_pct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'position.fixed_pct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'open_long',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
  })

  it('rejects display output that contains compound internal slot paths', () => {
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'risk.stop_loss_pct.valuePct',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
    expect(() => presentation.renderDisplay('condition.expression', {
      label: 'position.fixed_pct.value',
    })).toThrow('semantic_presentation_internal_key_leak:condition.expression')
  })

  it('rejects unknown enum display tokens without leaking raw values', () => {
    expectSemanticTokenNotFound(
      () => presentation.renderDisplay('position.dca_schedule', { triggerMode: 'triggerMode', maxCount: 3 }),
      'enum.dca.triggerMode.triggerMode',
    )
    expectSemanticTokenNotFound(
      () => presentation.renderDisplay('price.candle_pattern', { pattern: 'bearish_engulfing', direction: 'bullish' }),
      'enum.pattern.candle.bearish_engulfing',
    )
    expectSemanticTokenNotFound(
      () => presentation.renderDisplay('liquidity.sweep', { direction: 'bullish', reference: 'raw_session_pivot' }),
      'enum.reference.raw_session_pivot',
    )
    expectSemanticTokenNotFound(
      () => presentation.renderDisplay('external.signal', { provider: 'raw_provider' }),
      'enum.provider.raw_provider',
    )
  })

  describe('gate.regime entry', () => {
    it('exposes public metadata for gate.regime', () => {
      const entry = presentation.getEntry('gate.regime')
      expect(entry.publicName).toBe('趋势/状态过滤')
    })

    it('includes 趋势过滤 alias', () => {
      const entry = presentation.getEntry('gate.regime')
      expect(entry.aliases).toEqual(expect.arrayContaining(['趋势过滤']))
    })

    it('renders display string with EMA50 and 做多 without internal key leakage', () => {
      const entry = presentation.getEntry('gate.regime')
      const text = entry.displayRenderer({
        params: { sideScope: 'long', indicator: 'ema', period: 50, operator: 'GT' },
      })
      expect(text).toContain('EMA50')
      expect(text).toContain('做多')
      expect(text).not.toContain('gate.regime')
      expect(text).not.toContain('orchestration')
      expect(text).not.toContain('activeWhen')
      expect(text).not.toContain('block_new_entries')
    })

    it('renders clarification text containing 指标 and 周期', () => {
      const entry = presentation.getEntry('gate.regime')
      const text = entry.clarificationRenderer('orchestration.gate.regime.active_when', {})
      expect(text).toContain('指标')
      expect(text).toContain('周期')
    })
  })

  describe('portfolioRisk.drawdown_block entry', () => {
    it('exposes public metadata for portfolioRisk.drawdown_block', () => {
      const entry = presentation.getEntry('portfolioRisk.drawdown_block')
      expect(entry.publicName).toBe('组合回撤护栏')
      expect(entry.aliases).toEqual(expect.arrayContaining(['组合回撤']))
    })

    it('renders enforce-mode display string without leaking internal keys', () => {
      const entry = presentation.getEntry('portfolioRisk.drawdown_block')
      const text = entry.displayRenderer({ params: { thresholdPct: 10, mode: 'enforce' } })
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

    it('renders observe-mode display string without leaking internal keys', () => {
      const entry = presentation.getEntry('portfolioRisk.drawdown_block')
      const text = entry.displayRenderer({ params: { thresholdPct: 5, mode: 'observe' } })
      expect(text).toContain('5')
      expect(text).toContain('记录')
      expect(text).not.toContain('portfolioRisk.drawdown_block')
      expect(text).not.toContain('orchestration')
      expect(text).not.toContain('block_new_entries')
      expect(text).not.toContain('drawdown_block')
      expect(text).not.toContain('enforce')
      expect(text).not.toContain('observe')
    })

    it('renders clarification text containing 回撤 and 阈值', () => {
      const entry = presentation.getEntry('portfolioRisk.drawdown_block')
      const text = entry.clarificationRenderer('orchestration.portfolio_drawdown.threshold_pct', {})
      expect(text).toContain('回撤')
      expect(text).toContain('阈值')
    })
  })

  describe('program.fixed_grid_gated entry', () => {
    it('exposes public metadata for program.fixed_grid_gated', () => {
      const entry = presentation.getEntry('program.fixed_grid_gated')
      expect(entry.publicName).toBe('门控固定网格')
      expect(entry.aliases).toEqual(expect.arrayContaining(['门控网格']))
    })

    it('renders display string with cancel onDeactivate without leaking internal keys', () => {
      const entry = presentation.getEntry('program.fixed_grid_gated')
      const text = entry.displayRenderer({
        params: { lowerBound: 50000, upperBound: 60000, levelCount: 10, stepPct: 5, onDeactivate: 'cancel' },
      })
      expect(text).toContain('50000')
      expect(text).toContain('60000')
      expect(text).toContain('10')
      expect(text).toContain('5%')
      expect(text).toContain('撤单')
      expect(text).not.toContain('program.fixed_grid_gated')
      expect(text).not.toContain('orchestration')
      expect(text).not.toContain('fixed_grid_gated')
      expect(text).not.toMatch(/\bcancel\b|\bkeep\b|\bclose\b/u)
    })

    it('renders display string with close onDeactivate as 平仓', () => {
      const entry = presentation.getEntry('program.fixed_grid_gated')
      const text = entry.displayRenderer({
        params: { lowerBound: 50000, upperBound: 60000, levelCount: 10, stepPct: 5, onDeactivate: 'close' },
      })
      expect(text).toContain('平仓')
    })

    it('renders display string with keep onDeactivate as 保留挂单', () => {
      const entry = presentation.getEntry('program.fixed_grid_gated')
      const text = entry.displayRenderer({
        params: { lowerBound: 50000, upperBound: 60000, levelCount: 10, stepPct: 5, onDeactivate: 'keep' },
      })
      expect(text).toContain('保留挂单')
    })

    it('renders clarification text for gridParams containing 区间, 档数, 步长', () => {
      const entry = presentation.getEntry('program.fixed_grid_gated')
      const text = entry.clarificationRenderer('orchestration.program.fixed_grid_gated.gridParams', {})
      expect(text).toContain('区间')
      expect(text).toContain('档数')
      expect(text).toContain('步长')
    })
  })

  // Phase 5 S6 (#984)
  describe('program.adaptive_volatility_grid entry', () => {
    it('exposes public metadata for program.adaptive_volatility_grid', () => {
      const entry = presentation.getEntry('program.adaptive_volatility_grid')
      expect(entry.publicName).toBe('ATR 自适应网格')
      expect(entry.aliases).toEqual(expect.arrayContaining(['波动自适应网格']))
    })

    it('display 文本不出现内部 key（黑名单：3 内部字面量）', () => {
      const entry = presentation.getEntry('program.adaptive_volatility_grid')
      const text = entry.displayRenderer({
        params: {
          atrPeriod: 14,
          atrMultiplier: 1.5,
          rangeMultiplier: 3,
          minStepPct: 0.2,
          maxStepPct: 2,
          levelCount: 6,
          onDeactivate: 'cancel',
        },
      })
      // 负 grep（critic round 2 Q8）：禁内部 key 字面量
      expect(text).not.toMatch(/program\.adaptive_volatility_grid/)
      expect(text).not.toMatch(/atr_window/)
      expect(text).not.toMatch(/adaptive_volatility_grid/)
      // 正 grep（critic round 2 Q8）：保留用户友好 fragment
      expect(text).toMatch(/ATR/)
      expect(text).toMatch(/自适应网格/)
      expect(text).toContain('14')
      expect(text).toContain('1.5')
      expect(text).toContain('6 档')
      expect(text).toContain('钳制')
      expect(text).toContain('撤单')
    })

    it('display close / keep 渲染对应中文', () => {
      const entry = presentation.getEntry('program.adaptive_volatility_grid')
      expect(entry.displayRenderer({
        params: { atrPeriod: 14, atrMultiplier: 1, rangeMultiplier: 3, minStepPct: 0.2, maxStepPct: 2, levelCount: 6, onDeactivate: 'close' },
      })).toContain('平仓')
      expect(entry.displayRenderer({
        params: { atrPeriod: 14, atrMultiplier: 1, rangeMultiplier: 3, minStepPct: 0.2, maxStepPct: 2, levelCount: 6, onDeactivate: 'keep' },
      })).toContain('保留挂单')
    })

    it('clarification 文本不暴露 slotKey 原文', () => {
      const entry = presentation.getEntry('program.adaptive_volatility_grid')
      const text = entry.clarificationRenderer(
        'orchestration.program.adaptive_volatility_grid.atr_period',
        {},
      )
      expect(text).toContain('ATR 周期')
      expect(text).not.toContain('atr_period')
      expect(text).not.toContain('orchestration.program')
    })

    it('clarification 各 9 个 slot 都返回有意义文本', () => {
      const entry = presentation.getEntry('program.adaptive_volatility_grid')
      const slots = [
        'atr_period', 'atr_multiplier', 'range_multiplier',
        'atr_drift_pct', 'rebuild_cooldown_sec',
        'min_step_pct', 'max_step_pct', 'level_count',
        'sizing', 'active_when_ref',
      ]
      for (const slot of slots) {
        const text = entry.clarificationRenderer(`orchestration.program.adaptive_volatility_grid.${slot}`, {})
        expect(text.length).toBeGreaterThan(2)
        expect(text).not.toContain(slot)
      }
    })
  })

  it('renders clarification text without leaking raw slot keys', () => {
    const text = presentation.renderClarification('risk.stop_loss_pct', 'risk.stop_loss_pct.valuePct', {})

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
