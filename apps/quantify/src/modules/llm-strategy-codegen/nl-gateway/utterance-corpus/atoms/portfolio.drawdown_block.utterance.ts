import type { UtteranceCorpusCase } from '../utterance-corpus.types'

export const portfolioDrawdownBlockUtterances = [
  {
    id: 'portfolio-drawdown-block-zh-locked-account-pct',
    atomKey: 'portfolioRisk.drawdown_block',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，账户回撤超过 10% 停止开新仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'orchestrationPortfolioRisk',
      key: 'portfolioRisk.drawdown_block',
      status: 'locked',
      params: { thresholdPct: 10, mode: 'enforce' },
      openSlotKeys: [],
    },
  },
  {
    id: 'portfolio-drawdown-block-zh-locked-observe',
    atomKey: 'portfolioRisk.drawdown_block',
    locale: 'zh',
    coverage: 'locked',
    utterance: 'OKX 合约 BTCUSDT 15m，账户回撤超过 8% 仅记录，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'orchestrationPortfolioRisk',
      key: 'portfolioRisk.drawdown_block',
      status: 'locked',
      params: { thresholdPct: 8, mode: 'observe' },
      openSlotKeys: [],
    },
  },
  {
    id: 'portfolio-drawdown-block-mixed-locked-symbol-prefix',
    atomKey: 'portfolioRisk.drawdown_block',
    locale: 'mixed',
    coverage: 'locked',
    utterance: 'OKX perp BTCUSDT 15m，账户回撤超过 12% 停止开新仓，MA20 上穿 MA50 开多，单笔 10%。',
    expected: {
      owner: 'orchestrationPortfolioRisk',
      key: 'portfolioRisk.drawdown_block',
      status: 'locked',
      params: { thresholdPct: 12, mode: 'enforce' },
      openSlotKeys: [],
    },
  },
] satisfies readonly UtteranceCorpusCase[]
