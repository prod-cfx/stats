/**
 * ESLint flat config rule: no-atom-key-literal
 *
 * Issue #1279 PR2 — 阻断 codegen 12 段主数据流出现 atom key 字面量分支。
 *
 * 命中模式（BinaryExpression, operator '===' / '!==' / '==' / '!='，任意一侧 Literal）：
 *   key === 'oscillator.rsi_gte'
 *   'price.breakout_up' !== key
 *
 * 命中前缀（与 issue #1279 AC-4 一致）：
 *   action / risk / position / grid / volume / volatility / liquidity / indicator /
 *   strategy / oscillator / portfolioRisk / price / bollinger / external / market /
 *   trend / execution
 *
 * 真相源唯一: ATOM_CONTRACT_REGISTRY (apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/)
 * 任何想按 atom 分流的代码必须查注册表，而非写字面量分支。
 *
 * 例外（通过 flat config `ignores` 字段配置，不在本规则内开后门）:
 *   - atom-contract-registry.ts 自身
 *   - constants/canonical-strategy-capabilities.ts（FIRST_WAVE 派生器）
 *   - utterance-corpus 目录（NL fixture，词面就是字面量）
 *   - 所有 .spec.ts 测试文件（测试可写 atom 字面量做断言）
 *   - PR3a/3b/3c ratchet 待清理文件（每轮缩 1 个）
 */

const ATOM_KEY_PATTERN = /^(action|risk|position|grid|volume|volatility|liquidity|indicator|strategy|oscillator|portfolioRisk|price|bollinger|external|market|trend|execution)\.[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/

const EQUALITY_OPERATORS = new Set(['===', '!==', '==', '!='])

/** @returns {string | null} 命中的 atom key，否则 null */
function literalAtomKey(node) {
  if (!node) {
    return null
  }
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return ATOM_KEY_PATTERN.test(node.value) ? node.value : null
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    const raw = node.quasis[0].value.cooked
    return typeof raw === 'string' && ATOM_KEY_PATTERN.test(raw) ? raw : null
  }
  return null
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止用 atom key 字面量做相等/不等比较（Issue #1279 AC-4）',
      recommended: false,
    },
    schema: [],
    messages: {
      noAtomKeyLiteral:
        'Issue #1279 AC-4: 禁止 atom key 字面量比较 "{{ key }}"。改用 ATOM_CONTRACT_REGISTRY[key].bucket / surface / emit 等元数据派生分流；如确属真相源/fixture/测试，请把所在文件加入 eslint.config.js 的 ignores allowlist。',
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!EQUALITY_OPERATORS.has(node.operator)) {
          return
        }
        const leftKey = literalAtomKey(node.left)
        const rightKey = literalAtomKey(node.right)
        const hit = leftKey ?? rightKey
        if (hit) {
          context.report({
            node,
            messageId: 'noAtomKeyLiteral',
            data: { key: hit },
          })
        }
      },
      SwitchCase(node) {
        const hit = literalAtomKey(node.test)
        if (hit) {
          context.report({
            node,
            messageId: 'noAtomKeyLiteral',
            data: { key: hit },
          })
        }
      },
    }
  },
}

export default rule
