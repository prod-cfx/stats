/**
 * ESLint flat config rule: no-business-rule-in-dispatcher
 *
 * Issue #1279 PR2 turn 5 (AC-13) — 守 dispatcher 入口红线：
 *   "入口（dispatcher）永远只读 ATOM_CONTRACT_REGISTRY，业务规则全部沉淀
 *    到 atom contract。dispatcher 不允许'一个策略一个 if'。"
 *
 * 阻断模式：
 *   1. atom-key 字面量比较 / switch case（已由 no-atom-key-literal 覆盖）
 *   2. bucket 字面量比较 — `bucket === 'trigger' / 'action' / 'risk' /
 *      'positionConstraint' / 'orchestration'`
 *
 * 允许模式（数据派生表达式，不是分流分支）：
 *   - `Object.entries(REGISTRY).filter(([, c]) => c.bucket === 'trigger')`
 *     —— 是 filter 谓词、不是 if 分流
 *   - 通过 lookup table `BUCKET_TO_PATCH_SLOT[contract.bucket]` 派生
 *
 * 启用域: dispatcher 文件 only（apps/quantify/src/modules/llm-strategy-codegen/
 *         services/generic-seed-dispatcher.service.ts）
 */

const BUCKET_LITERALS = new Set([
  'trigger',
  'action',
  'risk',
  'positionConstraint',
  'orchestration',
  'position',
])

const EQUALITY_OPERATORS = new Set(['===', '!==', '==', '!='])

/** 判断该 BinaryExpression 是否在数组方法 callback（filter/map/some/every/find）的 body 内 */
function isInArrayCallbackPredicate(node) {
  let current = node.parent
  while (current) {
    if (
      (current.type === 'ArrowFunctionExpression' || current.type === 'FunctionExpression')
      && current.parent
      && current.parent.type === 'CallExpression'
      && current.parent.arguments.includes(current)
      && current.parent.callee
      && current.parent.callee.type === 'MemberExpression'
      && current.parent.callee.property
      && current.parent.callee.property.type === 'Identifier'
      && ['filter', 'map', 'some', 'every', 'find', 'findIndex', 'reduce'].includes(current.parent.callee.property.name)
    ) {
      return true
    }
    current = current.parent
  }
  return false
}

function literalBucket(node) {
  if (!node) return null
  if (node.type === 'Literal' && typeof node.value === 'string' && BUCKET_LITERALS.has(node.value)) {
    return node.value
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0 && node.quasis.length === 1) {
    const raw = node.quasis[0].value.cooked
    if (typeof raw === 'string' && BUCKET_LITERALS.has(raw)) return raw
  }
  return null
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止 dispatcher 内出现 bucket 字面量分流（Issue #1279 AC-13）',
      recommended: false,
    },
    schema: [],
    messages: {
      noBucketBranch:
        'Issue #1279 AC-13: dispatcher 内禁止 bucket 字面量比较 "{{ bucket }}"。改用 lookup table（如 BUCKET_TO_PATCH_SLOT[contract.bucket]）从 ATOM_CONTRACT_REGISTRY 派生；filter/map/some 等数组 predicate 内的 bucket 比较是允许的（属于数据派生表达式而非分流分支）。',
      noBucketSwitch:
        'Issue #1279 AC-13: dispatcher 内禁止 bucket 字面量 switch case "{{ bucket }}"。改用 lookup table 从 REGISTRY 派生。',
    },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (!EQUALITY_OPERATORS.has(node.operator)) return
        const hit = literalBucket(node.left) ?? literalBucket(node.right)
        if (!hit) return
        if (isInArrayCallbackPredicate(node)) return
        context.report({ node, messageId: 'noBucketBranch', data: { bucket: hit } })
      },
      SwitchCase(node) {
        const hit = literalBucket(node.test)
        if (!hit) return
        context.report({ node, messageId: 'noBucketSwitch', data: { bucket: hit } })
      },
    }
  },
}

export default rule
