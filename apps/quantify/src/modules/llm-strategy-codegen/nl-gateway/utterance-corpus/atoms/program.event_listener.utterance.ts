import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const programEventListenerUtterances = [
  { id: 'program-event-listener-zh-tradingview', atomKey: 'program.event_listener' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'OKX BTCUSDT 15m 订阅 tradingview 事件源，趋势上涨时启用事件监听，按 signalId 去重 5 秒。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.event_listener' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-event-listener-zh-discord', atomKey: 'program.event_listener' as const, locale: 'zh' as const, coverage: 'locked' as const, utterance: 'discord 事件监听 webhook 信号触发，过期 60 秒丢弃。', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.event_listener' as const, status: 'locked' as const, openSlotKeys: [] } },
  { id: 'program-event-listener-en-locked', atomKey: 'program.event_listener' as const, locale: 'en' as const, coverage: 'locked' as const, utterance: 'Event listener subscribed to tradingview:alpha, dedup by signalId within 5s, expire after 60s.', expected: { owner: 'orchestrationPortfolioRisk' as const, key: 'program.event_listener' as const, status: 'locked' as const, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
