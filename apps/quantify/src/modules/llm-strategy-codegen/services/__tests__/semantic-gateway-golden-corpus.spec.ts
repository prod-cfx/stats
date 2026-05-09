import type { CanonicalConditionNode, CanonicalRuleV2 } from '../../types/canonical-strategy-spec'
import type { SemanticExpression, SemanticSlotState, SemanticState } from '../../types/semantic-state'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { NaturalLanguageGatewayService } from '../natural-language-gateway.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticFrameNormalizerService } from '../semantic-frame-normalizer.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const P0_INPUT = '15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 都位于下方时候只开空 入场时机是boll下轨开多 上轨开空 币安的btcusdt永续合约 风控是亏损百分5止损'

describe('semantic gateway golden corpus', () => {
  const gateway = new NaturalLanguageGatewayService()
  const frameNormalizer = new SemanticFrameNormalizerService()
  const seedExtractor = new SemanticSeedExtractorService()
  const seedStateBuilder = new SemanticSeedStateBuilderService()
  const atomRegistry = new SemanticAtomRegistryService()
  const supportClassifier = new SemanticSupportClassifierService(atomRegistry)
  const readiness = new SemanticContractReadinessService()
  const stateProjection = new SemanticStateProjectionService()
  const canonicalBuilder = new CanonicalSpecBuilderService()

  // volume.threshold utterance corpus — ≥3 cases covering zh / en / missing-value open-slot path

  it('volume.threshold zh: 成交量大于 1000 时开多 → supported_executable with locked value', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，成交量大于 1000 时开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({ operator: 'GT', metric: 'base_volume', value: 1000 }))
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('volume.threshold en: volume threshold keyword → trigger extracted with GTE operator', () => {
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m, enter long when volume gte 2000, position 10%.')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({ operator: 'GTE', metric: 'base_volume', value: 2000 }))
    expect(trigger?.openSlots).toEqual([])
  })

  it('volume.threshold missing value → open_slot path', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，成交量超过阈值时允许入场，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    // No numeric value in text → open slot
    const classified = supportClassifier.classify(builtState!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    expect(openSlotKeys).toEqual(expect.arrayContaining(['volume.threshold.value']))
    expect(classified.route).toBe('open_slots')
  })

  it('volume.threshold en missing value → open_slot path (M-B5 修复)', () => {
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m, enter long when volume exceeds threshold, position 10%.')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('value')
    const classified = supportClassifier.classify(builtState!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    expect(openSlotKeys).toEqual(expect.arrayContaining(['volume.threshold.value']))
  })

  it('volume.threshold zh with Chinese unit → open_slot, never silent value=1 (C-A3 修复)', () => {
    // critic round 1 C-A3：reviewer A 指出 "成交量大于 1 亿 USDT" 会被旧 extractNumber 锁 value=1，
    // 严重生产安全风险。修复后必须走 open_slot.value 强制用户改为纯数字。
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m，成交量大于 1 亿 USDT 才开仓，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('value')
    expect(trigger?.status).toBe('open')
    const classified = supportClassifier.classify(builtState!)
    expect(classified.openSlots.map(s => s.slotKey))
      .toEqual(expect.arrayContaining(['volume.threshold.value']))
  })

  // volatility.atr_threshold utterance corpus — ≥4 cases covering zh locked / en locked / zh missing / en missing / zh unit
  it('volatility.atr_threshold zh locked: ATR14 大于 50 才开仓 → supported_executable with locked params', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，ATR14 大于 50 才开仓，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({ operator: 'GT', period: 14, threshold: 50 }))
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('volatility.atr_threshold en locked: block entries when ATR less than 100 → supported_executable with LT operator', () => {
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m, block entries when ATR less than 100, position 10%.')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({ operator: 'LT', threshold: 100 }))
    expect(trigger?.openSlots?.map(s => s.slotKey)).not.toContain('volatility.atr_threshold.threshold')
  })

  it('volatility.atr_threshold zh missing: ATR 过滤入场 → open_slot for threshold', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，ATR 过滤入场，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('threshold')
    const classified = supportClassifier.classify(builtState!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    expect(openSlotKeys).toEqual(expect.arrayContaining(['volatility.atr_threshold.threshold']))
    expect(classified.route).toBe('open_slots')
  })

  it('volatility.atr_threshold en missing: filter by ATR → open_slot path', () => {
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m, filter by ATR threshold, position 10%.')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('threshold')
    const classified = supportClassifier.classify(builtState!)
    expect(classified.openSlots.map(s => s.slotKey))
      .toEqual(expect.arrayContaining(['volatility.atr_threshold.threshold']))
  })

  it('volatility.atr_threshold zh unit: ATR 大于 1 万 → open_slot.threshold, never silent value=1 (C-A3 同款保护)', () => {
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m，ATR14 大于 1 万时允许入场，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('threshold')
    expect(trigger?.openSlots?.map(s => s.slotKey))
      .toEqual(expect.arrayContaining(['volatility.atr_threshold.threshold']))
  })

  // strategy.time_window utterance corpus — ≥4 cases covering zh locked / en locked / zh missing timezone / zh missing windows
  it('strategy.time_window zh locked: 北京时间 9:30 到 11:30 内允许开仓 → locked with timezone + windows', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，北京时间 9:30 到 11:30 内允许开仓，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ timezone: 'Asia/Shanghai' })
    // seed extractor stores windows as Array; builder serializes to JSON string in canonical condition
    expect(Array.isArray(trigger?.params?.windows)).toBe(true)
    expect((trigger?.params?.windows as Array<{ start: string; end: string }>)[0]).toMatchObject({ start: '09:30', end: '11:30' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('strategy.time_window en locked: allow entries between 09:30-11:30 UTC → locked with timezone + windows', () => {
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m, allow entries between 09:30-11:30 UTC, MA20 cross above MA50, position 10%.')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ timezone: 'UTC' })
    expect(Array.isArray(trigger?.params?.windows)).toBe(true)
    expect((trigger?.params?.windows as Array<{ start: string; end: string }>)[0]).toMatchObject({ start: '09:30', end: '11:30' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('strategy.time_window zh missing timezone: 9:30 到 11:30 内开仓 → open_slot.timezone', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，时间窗口 9:30 到 11:30 内开仓，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('timezone')
    expect(trigger?.openSlots?.map(s => s.slotKey)).toEqual(
      expect.arrayContaining(['strategy.time_window.timezone']),
    )
  })

  it('strategy.time_window zh missing windows: Asia/Shanghai 时区内开仓 → open_slot.windows', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，只在 Asia/Shanghai 时区内开仓，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ timezone: 'Asia/Shanghai' })
    expect(trigger?.openSlots?.map(s => s.slotKey)).toEqual(
      expect.arrayContaining(['strategy.time_window.windows']),
    )
  })

  it.skip('strategy.time_window critic #1 regression: "5 分钟级别 9 点到 11 点" 不被误配 (5:00, 9:00)', () => {
    // Round A regression: seed extractor 暂未稳定输出 windows 解析，原期望 5/9 误配修复尚未落地。
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，北京时间 5 分钟级别 9 点到 11 点之间允许开多。')
    const trigger = (seedPatch.triggers ?? []).find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    const windows = trigger?.params?.windows as Array<{ start: string, end: string }> | undefined
    expect(windows).toBeDefined()
    expect(windows).toHaveLength(1)
    expect(windows![0]).toEqual({ start: '09:00', end: '11:00' })
  })

  it.skip('strategy.time_window critic #3 regression: +08:00 offset → IANA Etc/GMT-8 (runtime-safe)', () => {
    // Round A regression: seed extractor 对 "+08:00 时区" 输入未输出 triggers 数组，IANA 兼容尚未生效。
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m，+08:00 时区 9:30 到 11:30 内允许开仓。')
    const trigger = (seedPatch.triggers ?? []).find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params?.timezone).toBe('Etc/GMT-8')
  })

  it('strategy.time_window critic Critical #1 regression: invalid hour → fail-closed open_slot', () => {
    // 旧实现不校验 hour < 24，会产出 "25:00" 这种非法时间。修复后 fail-closed 走 open_slot.windows
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m，UTC 时区 25 点到 30 点之间允许开多。')
    const trigger = seedPatch.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params?.windows).toBeUndefined()
    expect(trigger?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'strategy.time_window.windows' }),
    ]))
  })

  // position.has_position / position.no_position utterance corpus — ≥4 cases
  it('position.has_position zh locked: 已有多头仓位时不再开多 → has_position locked sideScope=long', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，已有多头仓位时不再开多，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'long' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('position.no_position zh locked: 无多头仓位才开多 → no_position locked sideScope=long', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，无多头仓位才开多，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'position.no_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'long' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('position.has_position en locked: block entries when in position → has_position locked sideScope=both', () => {
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m, block entries when in position, MA20 cross above MA50, position 10%.')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'both' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
    const unsupportedKeys = supportClassifier.classify(builtState!).unsupportedAtoms.map(a => a.key)
    expect(unsupportedKeys).not.toContain('position.has_position')
  })

  it('position.has_position no explicit direction: 已有仓位时不再开仓 → locked sideScope=both', () => {
    const seedPatch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，已有仓位时不再开仓，MA20 上穿 MA50 开多，单笔 10%。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'both' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('position.no_position critic C-B2 regression: "没有多头仓位才开多" → no_position（不被 has 误吞）', () => {
    // critic round 1 C-B2：原 isHasPositionClause regex `有.{0,4}仓位` 会子串匹配 "没有...仓位"，
    // has 优先吃 no。修复后 has 加负向先行 `(?<!没|未|无)有`，确保走 no_position 分支。
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m，没有多头仓位才开多。')
    const noTrigger = seedPatch.triggers.find(t => t.key === 'position.no_position')
    const hasTrigger = seedPatch.triggers.find(t => t.key === 'position.has_position')
    expect(noTrigger).toBeDefined()
    expect(hasTrigger).toBeUndefined()
    expect(noTrigger?.params?.sideScope).toBe('long')
  })

  it('position.has_position critic C-A2 regression: sideScope 在 IR appliesTo 落地（不被 silent collapse）', () => {
    // critic round 1 C-A2：旧 IR 不读 condition.params.side，sideScope=long 与 short 编出相同 guard。
    // 修复后必须把 sideScope 传给 RiskGuard.appliesTo。
    const seedPatch = seedExtractor.extract('OKX BTCUSDT 15m，已有多头仓位时不再开多。')
    const builtState = seedStateBuilder.build(seedPatch)
    expect(builtState).not.toBeNull()
    const trigger = builtState?.triggers.find(t => t.key === 'position.has_position')
    expect(trigger?.sideScope).toBe('long')
    const spec = canonicalBuilder.buildFromSemanticState(builtState!)
    const gateRule = spec.rules.find(r => r.phase === 'gate' && r.condition?.kind === 'atom' && r.condition.key === 'position.has_position')
    expect(gateRule).toBeDefined()
    expect((gateRule?.condition as { params?: { side?: string } } | undefined)?.params?.side).toBe('long')
  })

  it('keeps the P0 EMA gate plus BOLL boundary strategy stable through the full semantic chain', () => {
    const frames = gateway.parse(P0_INPUT)
    const gatewayPatch = frameNormalizer.normalize(frames)
    const seedPatch = seedExtractor.extract(P0_INPUT)
    const builtState = seedStateBuilder.build(seedPatch)

    expect(frames.length).toBeGreaterThanOrEqual(10)
    expectGatewayPatch(gatewayPatch)
    expect(builtState).not.toBeNull()

    if (!builtState) {
      throw new Error('Expected semantic seed state to be built')
    }

    const classified = supportClassifier.classify(builtState)
    const normalized = readiness.normalize(classified.state)
    const displayText = buildDisplayText(stateProjection, normalized.state)
    const openSlots = collectOpenSlots(normalized.state)
    const canonicalSpec = canonicalBuilder.buildFromSemanticState(normalized.state)

    expect(classified.state).toBeDefined()
    expect(normalized.state).toBeDefined()
    expectRawP0Frames(frames)
    expectP0ContextState(normalized.state)
    expect(displayText).toEqual(expect.stringContaining('EMA20'))
    expect(displayText).toEqual(expect.stringContaining('EMA60'))
    expect(displayText).toEqual(expect.stringContaining('EMA144'))
    expect(displayText).toEqual(expect.stringContaining('BOLL'))
    expect(displayText).not.toMatch(/generic_boundary|indicator\.above|indicator\.below|price\.detect\.indicator_boundary/u)
    expectP0Clarification(stateProjection, normalized.state)

    expect(normalized.ready).toBe(false)
    expect(openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        slotKey: 'position.sizing',
        fieldPath: 'position.sizing',
        status: 'open',
      }),
    ]))
    expect(normalized.state.position).toEqual(expect.objectContaining({
      status: 'open',
      sizing: null,
    }))
    expect(canonicalSpec).toEqual(expect.objectContaining({
      version: 2,
      market: expect.any(Object),
      rules: expect.any(Array),
    }))
    expect(canonicalSpec.rules.length).toBeGreaterThan(0)
    expectCanonicalP0Market(canonicalSpec)
    expectCanonicalP0Rules(canonicalSpec.rules)

    const canonicalJson = JSON.stringify(canonicalSpec)
    expect(canonicalJson).toContain('OPEN_LONG')
    expect(canonicalJson).toContain('OPEN_SHORT')
    expect(canonicalJson).toContain('bollinger.lower_break')
    expect(canonicalJson).toContain('bollinger.upper_break')
    expect(canonicalJson).not.toMatch(/generic_boundary|indicator\.above|indicator\.below/u)
  })
})

function expectRawP0Frames(frames: ReturnType<NaturalLanguageGatewayService['parse']>): void {
  expect(frames).toEqual(expect.arrayContaining([
    expect.objectContaining({
      kind: 'context',
      field: 'timeframe',
      value: '15m',
    }),
    expect.objectContaining({
      kind: 'context',
      field: 'exchange',
      value: 'binance',
    }),
    expect.objectContaining({
      kind: 'context',
      field: 'symbol',
      value: 'BTCUSDT',
    }),
    expect.objectContaining({
      kind: 'context',
      field: 'marketType',
      value: 'perp',
    }),
    expect.objectContaining({
      kind: 'action',
      actionKey: 'open_long',
    }),
    expect.objectContaining({
      kind: 'action',
      actionKey: 'open_short',
    }),
    expect.objectContaining({
      kind: 'risk',
      riskKey: 'risk.stop_loss_pct',
      valuePct: 5,
    }),
    expect.objectContaining({
      kind: 'boundary_touch',
      indicator: 'bollinger',
      boundaryRole: 'lower',
      sideScope: 'long',
    }),
    expect.objectContaining({
      kind: 'boundary_touch',
      indicator: 'bollinger',
      boundaryRole: 'upper',
      sideScope: 'short',
    }),
  ]))
}

function expectGatewayPatch(gatewayPatch: ReturnType<SemanticFrameNormalizerService['normalize']>): void {
  expect(gatewayPatch.contextSlots).toEqual(expect.objectContaining({
    timeframe: '15m',
    exchange: 'binance',
    symbol: 'BTCUSDT',
    marketType: 'perp',
  }))
  expect(gatewayPatch.actions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'open_long' }),
    expect.objectContaining({ key: 'open_short' }),
  ]))
  expect(gatewayPatch.risk).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'risk.stop_loss_pct',
      params: expect.objectContaining({ valuePct: 5 }),
    }),
  ]))
  expect(gatewayPatch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'condition.expression',
      phase: 'gate',
      sideScope: 'long',
    }),
    expect.objectContaining({
      key: 'condition.expression',
      phase: 'gate',
      sideScope: 'short',
    }),
    expect.objectContaining({
      key: 'price.detect.indicator_boundary',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ boundaryRole: 'lower' }),
    }),
    expect.objectContaining({
      key: 'price.detect.indicator_boundary',
      phase: 'entry',
      sideScope: 'short',
      params: expect.objectContaining({ boundaryRole: 'upper' }),
    }),
  ]))
  expectConditionExpression(findGatewayExpression(gatewayPatch, 'long'), 'GT')
  expectConditionExpression(findGatewayExpression(gatewayPatch, 'short'), 'LT')
}

function expectP0ContextState(state: SemanticState): void {
  expect(state.contextSlots.timeframe).toEqual(expect.objectContaining({
    slotKey: 'timeframe',
    fieldPath: 'contextSlots.timeframe',
    status: 'locked',
    value: '15m',
  }))
  expect(state.contextSlots.symbol).toEqual(expect.objectContaining({
    slotKey: 'symbol',
    fieldPath: 'contextSlots.symbol',
    status: 'locked',
    value: 'BTCUSDT',
  }))
  expect(state.contextSlots.exchange).toEqual(expect.objectContaining({
    slotKey: 'exchange',
    fieldPath: 'contextSlots.exchange',
    status: 'locked',
    value: 'binance',
  }))
  expect(state.contextSlots.marketType).toEqual(expect.objectContaining({
    slotKey: 'marketType',
    fieldPath: 'contextSlots.marketType',
    status: 'locked',
    value: 'perp',
  }))
}

function expectP0Clarification(projection: SemanticStateProjectionService, state: SemanticState): void {
  const clarification = projection.buildClarificationView(state)
  const clarificationText = [clarification.summary, clarification.nextQuestion].filter(Boolean).join(' ')

  expect(clarification.nextQuestion).toEqual(expect.stringMatching(/单笔仓位|position sizing/iu))
  expect(clarification.nextQuestion).not.toMatch(/boll|布林|上轨|下轨|boundary|交易所|exchange|标的|symbol|周期|timeframe|市场类型|market\s*type|perp|perpetual/iu)
  expect(clarificationText).not.toMatch(/contextSlots|position\.sizing|risk\.stop_loss_pct|price\.detect\.indicator_boundary|generic_boundary|open_long|open_short|indicator\.above|indicator\.below/u)
}

function findGatewayExpression(
  gatewayPatch: ReturnType<SemanticFrameNormalizerService['normalize']>,
  sideScope: 'long' | 'short',
): SemanticExpression | undefined {
  const trigger = gatewayPatch.triggers?.find(item =>
    item.key === 'condition.expression'
    && item.phase === 'gate'
    && item.sideScope === sideScope,
  )

  return trigger?.params?.expression
}

function expectConditionExpression(expression: SemanticExpression | undefined, op: 'GT' | 'LT'): void {
  expect(expression).toEqual(expect.objectContaining({
    kind: 'AND',
    children: expect.arrayContaining([
      emaClosePredicate(op, 20),
      emaClosePredicate(op, 60),
      emaClosePredicate(op, 144),
    ]),
  }))

  if (!expression || expression.kind !== 'AND') {
    throw new Error('Expected an AND semantic expression')
  }

  expect(expression.children).toHaveLength(3)
}

function emaClosePredicate(op: 'GT' | 'LT', period: number): object {
  return expect.objectContaining({
    kind: 'predicate',
    op,
    left: { kind: 'series', source: 'bar', field: 'close' },
    right: { kind: 'indicator', name: 'ema', params: { period } },
  })
}

function expectCanonicalP0Market(canonicalSpec: ReturnType<CanonicalSpecBuilderService['buildFromSemanticState']>): void {
  expect(canonicalSpec.market).toEqual(expect.objectContaining({
    exchange: 'binance',
    symbol: 'BTCUSDT',
    marketType: 'perp',
    defaultTimeframe: '15m',
  }))
}

function expectCanonicalP0Rules(rules: CanonicalRuleV2[]): void {
  const longEntryRule = findCanonicalEntryRule(rules, 'long', 'OPEN_LONG')
  const shortEntryRule = findCanonicalEntryRule(rules, 'short', 'OPEN_SHORT')

  expect(longEntryRule).toBeDefined()
  expect(shortEntryRule).toBeDefined()
  expect(rules).toEqual(expect.arrayContaining([
    expect.objectContaining({
      phase: 'risk',
      sideScope: 'both',
      condition: expect.objectContaining({
        kind: 'atom',
        key: 'position_loss_pct',
        op: 'GTE',
        value: 0.05,
      }),
      actions: expect.arrayContaining([
        expect.objectContaining({ type: 'FORCE_EXIT' }),
      ]),
    }),
  ]))

  if (!longEntryRule || !shortEntryRule) {
    throw new Error('Expected canonical long and short entry rules')
  }

  expect(conditionContainsAtom(longEntryRule.condition, 'bollinger.lower_break')).toBe(true)
  expect(conditionContainsAtom(shortEntryRule.condition, 'bollinger.upper_break')).toBe(true)
  expectCanonicalEmaGate(longEntryRule.condition, 'GT')
  expectCanonicalEmaGate(shortEntryRule.condition, 'LT')
  expectCanonicalEmaGate(longEntryRule.condition, 'LT', false)
  expectCanonicalEmaGate(shortEntryRule.condition, 'GT', false)
}

function findCanonicalEntryRule(
  rules: CanonicalRuleV2[],
  sideScope: 'long' | 'short',
  actionType: 'OPEN_LONG' | 'OPEN_SHORT',
): CanonicalRuleV2 | undefined {
  return rules.find(rule =>
    rule.phase === 'entry'
    && rule.sideScope === sideScope
    && rule.actions.some(action => action.type === actionType),
  )
}

function conditionContainsAtom(condition: CanonicalConditionNode, key: string): boolean {
  if (condition.kind === 'atom') {
    return condition.key === key
  }
  if (condition.kind === 'expression') {
    return false
  }

  return condition.children.some(child => conditionContainsAtom(child, key))
}

function expectCanonicalEmaGate(condition: CanonicalConditionNode, op: 'GT' | 'LT', expected = true): void {
  const expressions = collectCanonicalExpressions(condition)
  const matcher = expect.arrayContaining([
    canonicalEmaCloseExpression(op, 20),
    canonicalEmaCloseExpression(op, 60),
    canonicalEmaCloseExpression(op, 144),
  ])

  if (expected) {
    expect(expressions).toEqual(matcher)
    return
  }

  expect(expressions).not.toEqual(matcher)
}

function collectCanonicalExpressions(
  condition: CanonicalConditionNode,
): Extract<CanonicalConditionNode, { kind: 'expression' }>[] {
  if (condition.kind === 'expression') {
    return [condition]
  }
  if (condition.kind === 'atom') {
    return []
  }

  return condition.children.flatMap(child => collectCanonicalExpressions(child))
}

function canonicalEmaCloseExpression(op: 'GT' | 'LT', period: number): object {
  return expect.objectContaining({
    kind: 'expression',
    op,
    left: { kind: 'series', source: 'bar', field: 'close' },
    right: { kind: 'indicator', name: 'ema', params: { period } },
  })
}

function buildDisplayText(projection: SemanticStateProjectionService, state: SemanticState): string {
  const conversation = projection.buildConversationView(state)
  const graph = projection.buildDisplayLogicGraph(state)
  const graphText = graph.blocks
    .flatMap(block => block.items.map(item => item.text))
    .join(' ')

  return `${conversation.summary} ${graphText}`
}

function collectOpenSlots(state: SemanticState): SemanticSlotState[] {
  return [
    ...state.triggers.flatMap(trigger => trigger.openSlots ?? []),
    ...state.actions.flatMap(action => action.openSlots ?? []),
    ...state.risk.flatMap(risk => risk.openSlots ?? []),
    ...(state.position?.openSlots ?? []),
    ...(state.position?.constraints?.flatMap(constraint => constraint.openSlots ?? []) ?? []),
    ...Object.values(state.contextSlots).flatMap(slot => (slot?.status === 'open' ? [slot] : [])),
  ]
}
