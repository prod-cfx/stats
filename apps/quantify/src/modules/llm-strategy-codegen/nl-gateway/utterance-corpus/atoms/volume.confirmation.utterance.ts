import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const volumeConfirmationUtterances = [
  { id: 'volume-confirmation-breakout-zh', atomKey: 'volume.confirmation', locale: 'zh', coverage: 'locked', utterance: '突破后需要放量确认再开多，单笔 10%。', expected: { owner: 'trigger', key: 'volume.confirmation', status: 'locked', params: { mode: 'confirm_breakout', multiplier: 1.5, refWindow: 20 }, openSlotKeys: [] } },
  { id: 'volume-confirmation-breakout-en', atomKey: 'volume.confirmation', locale: 'en', coverage: 'locked', utterance: 'Confirm breakout with volume above 1.5x average before entering long.', expected: { owner: 'trigger', key: 'volume.confirmation', status: 'locked', params: { mode: 'confirm_breakout', multiplier: 1.5, refWindow: 20 }, openSlotKeys: [] } },
  { id: 'volume-confirmation-pullback-zh', atomKey: 'volume.confirmation', locale: 'zh', coverage: 'locked', utterance: '回踩后量能确认再买入，仓位 10%。', expected: { owner: 'trigger', key: 'volume.confirmation', status: 'locked', params: { mode: 'confirm_pullback', multiplier: 1.5, refWindow: 20 }, openSlotKeys: [] } },
] satisfies readonly UtteranceCorpusCase[]
