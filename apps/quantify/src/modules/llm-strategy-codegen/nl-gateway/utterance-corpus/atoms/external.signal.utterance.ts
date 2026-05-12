import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const externalSignalUtterances = [
  {
    id: 'external-signal-zh-locked-webhook-signal-id',
    atomKey: 'external.signal',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，收到 webhook 事件 signalId 为 whale_buy 且 secret 已配置时开多，每次 100 USDT，止损 5%。',
    expected: {
      owner: 'trigger',
      key: 'external.signal',
      status: 'open',
      params: { provider: 'webhook', signalId: 'whale_buy', secret: 'configured' },
      openSlotKeys: [],
    },
  },
  {
    id: 'external-signal-en-locked-webhook-signal-id',
    atomKey: 'external.signal',
    locale: 'en',
    coverage: 'locked',
    utterance: 'OKX BTCUSDT 15m, on webhook signalId whale_buy with secret configured, open long 100 USDT and stop loss 5%.',
    expected: {
      owner: 'trigger',
      key: 'external.signal',
      status: 'open',
      params: { provider: 'webhook', signalId: 'whale_buy', secret: 'configured' },
      openSlotKeys: [],
    },
  },
  {
    id: 'external-signal-zh-open-slot-missing-signal-id',
    atomKey: 'external.signal',
    locale: 'zh',
    coverage: 'open-slot',
    utterance: 'OKX 合约 BTCUSDT 15m，收到 webhook 信号且 secret 已配置时开多，每次 100 USDT。',
    expected: {
      owner: 'trigger',
      key: 'external.signal',
      status: 'open',
      params: { provider: 'webhook', secret: 'configured' },
      openSlotKeys: ['external.signal.signalId'],
    },
  },
  {
    id: 'external-signal-en-open-slot-missing-secret',
    atomKey: 'external.signal',
    locale: 'en',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m, when webhook signalId=whale_sell arrives, open short 100 USDT.',
    expected: {
      owner: 'trigger',
      key: 'external.signal',
      status: 'open',
      params: { provider: 'webhook', signalId: 'whale_sell' },
      openSlotKeys: ['external.signal.secret'],
    },
  },
  {
    id: 'external-signal-mixed-open-slot-provider',
    atomKey: 'external.signal',
    locale: 'mixed',
    coverage: 'open-slot',
    utterance: 'OKX BTCUSDT 15m，外部信号 whale_buy 触发后开多，secret 已配置。',
    expected: {
      owner: 'trigger',
      key: 'external.signal',
      status: 'open',
      params: { signalId: 'whale_buy', secret: 'configured' },
      openSlotKeys: ['external.signal.provider'],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
