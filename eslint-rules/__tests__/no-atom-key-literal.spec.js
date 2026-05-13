/**
 * 使用 ESLint 官方 RuleTester（flat config 模式），不走 jest——eslint 自带断言。
 * 走 node --test 跑：node --test eslint-rules/__tests__/no-atom-key-literal.spec.js
 */
import { RuleTester } from 'eslint'
import rule from '../no-atom-key-literal.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

ruleTester.run('no-atom-key-literal', rule, {
  valid: [
    // 非 atom key 字面量比较
    { code: "if (kind === 'trigger') {}" },
    { code: "if (status !== 'ready') {}" },
    // 不是相等比较
    { code: "const x = 'oscillator.rsi_gte'" },
    { code: "const arr = ['oscillator.rsi_gte', 'price.breakout_up']" },
    // 查注册表的合法形态
    { code: 'if (registry[key].bucket === \'trigger\') {}' },
    // atom key 出现在变量名 / 属性键，不是比较右值
    { code: "const map = { 'oscillator.rsi_gte': 1 }" },
    // 前缀不在 17 大白名单（避免误伤普通字符串）
    { code: "if (key === 'foo.bar') {}" },
    { code: "if (kind === 'user.login') {}" },
  ],
  invalid: [
    {
      code: "if (key === 'oscillator.rsi_gte') {}",
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    {
      code: "if ('price.breakout_up' !== key) {}",
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    {
      code: "function f(atom){ if (atom == 'action.add_position') return 1 }",
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    {
      code: 'switch (k) { case \'bollinger.touch_middle\': break }',
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    {
      code: 'if (k === `external.signal`) {}',
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    {
      code: "const t = key === 'grid.range_rebalance' ? 1 : 0",
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    // review M7：array callback predicate 内 atom-key 字面量也必须禁——
    // 与 no-business-rule-in-dispatcher（豁免 callback predicate 的 bucket 比较）
    // 不同：atom-key 字面量分流是补丁路径，无任何 callback 例外。
    {
      code: 'arr.filter(k => k === \'oscillator.rsi_gte\')',
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    {
      code: 'arr.some(k => \'price.breakout_up\' === k)',
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
    {
      code: 'arr.find(k => k === \'action.add_position\')',
      errors: [{ messageId: 'noAtomKeyLiteral' }],
    },
  ],
})

// node --test 兼容：RuleTester 在 ESLint 9 里同步抛错即 fail，run() 返回即 pass
console.log('no-atom-key-literal: all RuleTester cases passed')
