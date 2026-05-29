import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const timeCooldownWindowUtterances = [
  { id: 'time-cooldown-bars-zh', atomKey: 'time.cooldown_window', locale: 'zh', coverage: 'locked', utterance: '每次交易后冷却 5 根 K 线再开仓。', expected: { owner: 'trigger', key: 'time.cooldown_window', status: 'locked', params: { durationBars: 5 }, openSlotKeys: [] } },
  { id: 'time-cooldown-minutes-en', atomKey: 'time.cooldown_window', locale: 'en', coverage: 'locked', utterance: 'Wait 30 minutes after an exit before re-entering.', expected: { owner: 'trigger', key: 'time.cooldown_window', status: 'locked', params: { durationMinutes: 30 }, openSlotKeys: [] } },
  { id: 'time-cooldown-stoploss-zh', atomKey: 'time.cooldown_window', locale: 'zh', coverage: 'locked', utterance: '止损后 10 根 K 内不再入场。', expected: { owner: 'trigger', key: 'time.cooldown_window', status: 'locked', params: { durationBars: 10, scope: 'after_stop_loss' }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
