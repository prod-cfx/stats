/**
 * Issue #1279 PR2c3-A — dispatcher 短句 symbol 推断守门 spec
 *
 * open-slot 问询（如"请选择标的"）的用户回复通常是极短的单词：
 *   "BTC" / "ETH" / "SOL"
 *
 * dispatcher 在没有 BASE+QUOTE 显式组合时，应推断 quote=USDT（default），
 * 并使用 source='inferred' + quoteSource='default_usdt' 与 user_explicit 路径区分。
 *
 * 红线（AC-13）：dispatcher 不含 bucket 字面量分流；短句推断走 const Set + regex，
 * 不写 `if (symbol === 'BTC')` 式硬编码。
 *
 * Refs: #1279
 */

import type { CodegenSemanticPatch } from '../../types/codegen-semantic-patch'
import type { ExplicitSymbolSlot, InferredSymbolSlot } from '../generic-seed-dispatcher.service'
import { GenericSeedDispatcher } from '../generic-seed-dispatcher.service'

type ContextSymbolSlot = InferredSymbolSlot | ExplicitSymbolSlot | undefined

describe('dispatcher 短句 symbol 推断（PR2c3-A）', () => {
  const dispatcher = new GenericSeedDispatcher()

  function contextSymbol(patch: CodegenSemanticPatch): ContextSymbolSlot {
    return (patch.contextSlots as { symbol?: ContextSymbolSlot } | undefined)?.symbol
  }

  it('单字 "BTC" → inferred BTCUSDT, quoteSource=default_usdt', () => {
    const patch = dispatcher.dispatch('BTC')
    const sym = contextSymbol(patch)
    expect(sym).toBeDefined()
    expect(sym?.value).toBe('BTCUSDT')
    expect(sym?.source).toBe('inferred')
    expect(sym?.quoteSource).toBe('default_usdt')
    expect(sym?.base).toBe('BTC')
    expect(sym?.quote).toBe('USDT')
    expect(sym?.evidenceText).toBe('BTC')
  })

  it('单字 "ETH" → inferred ETHUSDT, quoteSource=default_usdt', () => {
    const patch = dispatcher.dispatch('ETH')
    const sym = contextSymbol(patch)
    expect(sym).toBeDefined()
    expect(sym?.value).toBe('ETHUSDT')
    expect(sym?.source).toBe('inferred')
    expect(sym?.quoteSource).toBe('default_usdt')
  })

  it('单字 "SOL" → inferred SOLUSDT, quoteSource=default_usdt', () => {
    const patch = dispatcher.dispatch('SOL')
    const sym = contextSymbol(patch)
    expect(sym).toBeDefined()
    expect(sym?.value).toBe('SOLUSDT')
    expect(sym?.source).toBe('inferred')
    expect(sym?.quoteSource).toBe('default_usdt')
  })

  it('已含 quote 的 "BTCUSDT" → user_explicit, quoteSource=explicit（不走推断路径）', () => {
    const patch = dispatcher.dispatch('BTCUSDT')
    const sym = contextSymbol(patch)
    expect(sym).toBeDefined()
    expect(sym?.value).toBe('BTCUSDT')
    expect(sym?.source).toBe('user_explicit')
    expect(sym?.quoteSource).toBe('explicit')
  })

  it('空字符串不抛异常，contextSlots 为 undefined', () => {
    expect(() => dispatcher.dispatch('')).not.toThrow()
    const patch = dispatcher.dispatch('')
    expect(contextSymbol(patch)).toBeUndefined()
  })

  it('纯 quote token "USDT" 不被推断为 base（USDT 在排除集中）', () => {
    const patch = dispatcher.dispatch('USDT')
    // USDT 是 quote 货币本身，不应产出 symbol 推断
    expect(contextSymbol(patch)).toBeUndefined()
  })

  // C1: 技术指标关键词不应被推断为 base symbol
  it.each([
    ['MACD', 'MACDUSDT'],
    ['RSI', 'RSIUSDT'],
    ['DCA', 'DCAUSDT'],
    ['EMA', 'EMAUSDT'],
    ['VWAP', 'VWAPUSDT'],
  ] as const)('指标关键词 "%s" 不应产出 symbol 推断（不得输出 %s）', (token) => {
    const patch = dispatcher.dispatch(token)
    expect(contextSymbol(patch)).toBeUndefined()
  })

  // C2: 两字母 token 下限收紧到 3，'AI'/'OK' 不推断
  it.each([
    'AI',
    'OK',
  ])('两字母 token "%s" 不应被推断为 base（regex 下限 ≥3）', (token) => {
    const patch = dispatcher.dispatch(token)
    expect(contextSymbol(patch)).toBeUndefined()
  })

  // M2: 中文标点分隔符下的短句推断
  it.each([
    ['标的：BTC！', 'BTCUSDT'],
    ['(BTC)', 'BTCUSDT'],
    ['（SOL）', 'SOLUSDT'],
    ['请选择标的？BTC', 'BTCUSDT'],
  ] as const)('带中文标点 "%s" 正确提取 base → %s', (utterance, expected) => {
    const patch = dispatcher.dispatch(utterance)
    const sym = contextSymbol(patch)
    expect(sym?.value).toBe(expected)
    expect(sym?.source).toBe('inferred')
  })

  // M4-a: QUOTE_TOKENS 全覆盖——稳定币/法币 quote 均不被推断为 base
  it.each([
    'USDC',
    'BUSD',
    'USD',
    'TUSD',
    'FDUSD',
  ])('quote token "%s" 不被推断为 base（在 QUOTE_TOKENS 排除集中）', (token) => {
    const patch = dispatcher.dispatch(token)
    expect(contextSymbol(patch)).toBeUndefined()
  })

  // M4-b: 格式边界——小写/带空格/含数字/双 base 均不触发推断
  it('小写 "btc" 大小写不敏感，推断为 BTCUSDT（evidenceText 保留原始大小写）', () => {
    const patch = dispatcher.dispatch('btc')
    // tryInferShortSymbol 内部 toUpperCase，小写输入也应推断成功
    const sym = contextSymbol(patch)
    expect(sym?.value).toBe('BTCUSDT')
    expect(sym?.source).toBe('inferred')
    expect(sym?.evidenceText).toBe('btc')
  })

  it('"BTC " 尾部空格：trim 后等价 "BTC"，推断为 BTCUSDT', () => {
    // dispatcher 内部 text.trim()，空格已被裁剪
    const patch = dispatcher.dispatch('BTC ')
    const sym = contextSymbol(patch)
    expect(sym?.value).toBe('BTCUSDT')
    expect(sym?.source).toBe('inferred')
  })

  it('"BTC100" 含数字不匹配 SHORT_SYMBOL_RE（仅字母）', () => {
    const patch = dispatcher.dispatch('BTC100')
    // BTC100 不是纯大写字母 token，SHORT_SYMBOL_RE /^[A-Z]{3,10}$/ 不命中
    expect(contextSymbol(patch)).toBeUndefined()
  })
})
