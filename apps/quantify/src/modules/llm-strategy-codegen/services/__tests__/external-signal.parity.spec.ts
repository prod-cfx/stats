/**
 * external.signal atom 五层 parity spec（atom-only `supported_requires_slot`，
 * 无 canonical / IR 路径，故仅测 Layer 1-4 + Layer 7）
 *
 * 覆盖：
 * 1. atom registry: supported_requires_slot + executableSinceVersion=undefined + requiredParams
 * 2. seed extractor: provider 关键词锁定 + 必填 slot 始终 open（signalId / secret）
 * 3. semantic state: trigger 状态构建
 * 4. readiness/classifier: 永远走 open_slots 路径，不会进入 unsupportedAtoms 或 unknownAtoms
 * 7. display + clarification renderer
 */

import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const atomRegistry = new SemanticAtomRegistryService()
const seedExtractor = new SemanticSeedExtractorService()
const seedStateBuilder = new SemanticSeedStateBuilderService()
const supportClassifier = new SemanticSupportClassifierService(atomRegistry)
const readiness = new SemanticContractReadinessService()
const presentationRegistry = new SemanticPresentationRegistryService(atomRegistry)

const TRADINGVIEW_UTTERANCE = 'OKX 合约 BTCUSDT 15m，收到 tradingview webhook 信号后开多，5% 止损。'
const DISCORD_UTTERANCE = 'OKX BTCUSDT 15m, on discord buy signal open long, 5% stop loss.'
const TELEGRAM_UTTERANCE = 'OKX 合约 BTCUSDT 15m，telegram bot 推送外部信号 BTC_LONG_01 时开仓，5% 止损。'
const GENERIC_UTTERANCE = 'OKX 合约 BTCUSDT 15m，收到外部喊单群信号就开多，单笔 10%。'

describe('external.signal atom 五层 parity', () => {
  // ─── Layer 1: atom registry ──────────────────────────────────────────────────

  describe('Layer 1 — atom registry', () => {
    it('external.signal is supported_requires_slot', () => {
      const atom = atomRegistry.get('external.signal')
      expect(atom.supportStatus).toBe('supported_requires_slot')
    })

    it('executableSinceVersion is undefined (atom-only, no webhook runtime)', () => {
      const atom = atomRegistry.get('external.signal') as { executableSinceVersion?: string }
      expect(atom.executableSinceVersion).toBeUndefined()
    })

    it('requiredParams includes provider, signalId, secret', () => {
      const atom = atomRegistry.get('external.signal')
      expect(atom.requiredParams).toEqual(expect.arrayContaining(['provider', 'signalId', 'secret']))
    })

    it('category is trigger', () => {
      const atom = atomRegistry.get('external.signal')
      expect(atom.category).toBe('trigger')
    })

    it('executableProjection placeholder is external_signal_runtime (no canonical/spec path)', () => {
      const atom = atomRegistry.get('external.signal')
      // 与 sibling supported_requires_slot 保持非空约束一致，但显式排除 canonical_spec_v2 / compiled_runtime
      expect(atom.executableProjection).toEqual(['external_signal_runtime'])
      expect(atom.executableProjection).not.toContain('canonical_spec_v2')
      expect(atom.executableProjection).not.toContain('compiled_runtime')
    })
  })

  // ─── Layer 2: seed extractor ─────────────────────────────────────────────────

  describe('Layer 2 — seed extractor', () => {
    it('tradingview keyword: provider locked to "tradingview"', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'external.signal')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.provider).toBe('tradingview')
    })

    it('discord keyword: provider locked to "discord"', () => {
      const patch = seedExtractor.extract(DISCORD_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'external.signal')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.provider).toBe('discord')
    })

    it('telegram keyword: provider locked to "telegram"', () => {
      const patch = seedExtractor.extract(TELEGRAM_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'external.signal')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.provider).toBe('telegram')
    })

    it('generic 外部喊单 (no provider keyword): provider open_slot', () => {
      const patch = seedExtractor.extract(GENERIC_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'external.signal')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.provider).toBeUndefined()
      const slotKeys = trigger?.openSlots?.map(s => s.slotKey) ?? []
      expect(slotKeys).toContain('external.signal.provider')
    })

    it('signalId and secret always open_slot (cannot be inferred from text)', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'external.signal')
      const slotKeys = trigger?.openSlots?.map(s => s.slotKey) ?? []
      expect(slotKeys).toEqual(expect.arrayContaining([
        'external.signal.signalId',
        'external.signal.secret',
      ]))
    })

    it('status is "open" — never silently locked even with provider extracted', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'external.signal')
      expect(trigger?.status).toBe('open')
    })

    // critic round 1 P4-5 B2 回归：provider 关键词必须与 signal-semantic 词共现
    it('B2 negative: bare provider keyword without signal context → 不产生 external.signal trigger', () => {
      const noSignalUtterances = [
        'OKX BTCUSDT 15m，下载 webhook 接口文档后再说，单笔 10%。',
        'OKX BTCUSDT 15m，讨论 telegram 群里聊聊行情，单笔 10%。',
        'OKX BTCUSDT 15m，研究下 tradingview 平台的功能，单笔 10%。',
        'OKX BTCUSDT 15m，加入 discord 服务器交流，单笔 10%。',
      ]
      for (const utterance of noSignalUtterances) {
        const patch = seedExtractor.extract(utterance)
        const trigger = patch.triggers?.find(t => t.key === 'external.signal')
        expect(trigger).toBeUndefined()
      }
    })

    it('B2 positive: provider keyword + signal context → external.signal trigger', () => {
      const signalUtterances = [
        'OKX BTCUSDT 15m，tradingview 信号触发后开多，单笔 10%。',
        'OKX BTCUSDT 15m，discord bot 推送 buy 信号开多，单笔 10%。',
        'OKX BTCUSDT 15m，收到 telegram 信号就开仓，单笔 10%。',
        'OKX BTCUSDT 15m, on webhook signal open long, 5% stop loss.',
      ]
      for (const utterance of signalUtterances) {
        const patch = seedExtractor.extract(utterance)
        const trigger = patch.triggers?.find(t => t.key === 'external.signal')
        expect(trigger).toBeDefined()
      }
    })
  })

  // ─── Layer 3: semantic state builder ────────────────────────────────────────

  describe('Layer 3 — semantic state builder', () => {
    it('builds external.signal trigger in semantic state', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const trigger = state?.triggers?.find(t => t.key === 'external.signal')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.provider).toBe('tradingview')
    })

    it('trigger status remains open in semantic state (signalId/secret missing)', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      const trigger = state?.triggers?.find(t => t.key === 'external.signal')
      expect(trigger?.status).toBe('open')
    })
  })

  // ─── Layer 4: classifier / readiness ─────────────────────────────────────────

  describe('Layer 4 — classifier / readiness gate', () => {
    it('external.signal not in unknownAtoms (registered, recognized)', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      expect(classified.unknownAtoms).not.toContain('external.signal')
    })

    it('external.signal not in unsupportedAtoms (supported_requires_slot)', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
      expect(unsupportedKeys).not.toContain('external.signal')
    })

    it('classifier route: not unknown_unsupported (now requires_slot path)', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      expect(classified.route).not.toBe('unknown_unsupported')
    })

    it('open_slots include external.signal.signalId and external.signal.secret', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const openSlotKeys = classified.openSlots.map(s => s.slotKey)
      expect(openSlotKeys).toEqual(expect.arrayContaining([
        'external.signal.signalId',
        'external.signal.secret',
      ]))
    })

    it('readiness keeps trigger requires_slot: state stays blocking until user fills slots', () => {
      const patch = seedExtractor.extract(TRADINGVIEW_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const trigger = normalized.state.triggers?.find(t => t.key === 'external.signal')
      expect(trigger?.status).toBe('open')
    })
  })

  // ─── Layer 7: display + clarification renderer ───────────────────────────────

  describe('Layer 7 — display + clarification renderer', () => {
    it('displayRenderer: tradingview → "TradingView 喊单信号"', () => {
      const display = presentationRegistry.renderDisplay('external.signal', { provider: 'tradingview' })
      expect(display).toContain('TradingView')
    })

    it('displayRenderer: discord → "Discord 喊单信号"', () => {
      const display = presentationRegistry.renderDisplay('external.signal', { provider: 'discord' })
      expect(display).toContain('Discord')
    })

    it('publicName is 外部喊单 / Webhook 信号', () => {
      const entry = presentationRegistry.getEntry('external.signal')
      expect(entry?.publicName).toContain('外部喊单')
    })

    it('goldenUtterances has ≥ 3 entries', () => {
      const entry = presentationRegistry.getEntry('external.signal')
      expect(entry?.goldenUtterances?.length).toBeGreaterThanOrEqual(3)
    })

    it('clarificationRenderer: external.signal.provider slot → provider prompt', () => {
      const text = presentationRegistry.renderClarification('external.signal', 'external.signal.provider', {})
      expect(text).toContain('tradingview')
    })

    it('clarificationRenderer: external.signal.signalId slot → signalId prompt', () => {
      const text = presentationRegistry.renderClarification('external.signal', 'external.signal.signalId', {})
      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain('信号')
    })

    it('clarificationRenderer: external.signal.secret slot → secret prompt mentions HMAC', () => {
      const text = presentationRegistry.renderClarification('external.signal', 'external.signal.secret', {})
      expect(text).toContain('HMAC')
    })
  })
})
