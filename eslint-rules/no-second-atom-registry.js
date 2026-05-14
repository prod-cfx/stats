/**
 * ESLint flat config rule: no-second-atom-registry
 *
 * Issue #1334 AC-8 — 阻断在 llm-strategy-codegen 内新建第二个 atom 数据源。
 *
 * 检测策略（选项 A：structural 检测，不依赖变量命名）：
 *
 *   检测 "atom record array"——ArrayExpression 中存在至少一个 ObjectExpression，
 *   该对象同时包含字符串 property `key` 和字符串 property `supportStatus`。
 *   这是 SemanticRegisteredAtomDefinition / SemanticRecognizedUnsupportedAtomDefinition
 *   的最小必要特征，不论变量名是什么。
 *
 *   命中形态（全部触发）：
 *     const fake     = [{ key: 'x.y', supportStatus: '...' }]           // 直接数组
 *     const fakeMap  = new Map([[...{key, supportStatus}...]])           // new Map 包含 atom 结构
 *     export const X = [{ key: '...', supportStatus: '...' }]           // export
 *
 * 真相源唯一: ATOM_CONTRACT_REGISTRY (atom-contracts/atom-contract-registry.ts)
 * 适配层唯一: semantic-atom-registry.service.ts (STANDALONE_ATOM_MAP)
 *
 * 永久豁免（通过 eslint.config.js ignores 配置，不在本规则内开后门）：
 *   - atom-contract-registry.ts 自身
 *   - semantic-atom-registry.service.ts（STANDALONE_ATOM_MAP 合法存在）
 *   - 所有 .spec.ts / .invariant.spec.ts 测试文件
 */

/**
 * 判断 ObjectExpression 是否包含指定字符串 property key。
 * @param {import('estree').ObjectExpression} obj
 * @param {string} propName
 * @returns {boolean}
 */
function hasStringProp(obj, propName) {
  return obj.properties.some(
    p =>
      p.type === 'Property' &&
      !p.computed &&
      ((p.key.type === 'Identifier' && p.key.name === propName) ||
        (p.key.type === 'Literal' && p.key.value === propName)) &&
      p.value.type === 'Literal' &&
      typeof p.value.value === 'string',
  )
}

/**
 * 判断 ArrayExpression 中是否存在符合 atom record 结构的对象元素：
 * 同时含 string `key` 和 string `supportStatus` property。
 * @param {import('estree').ArrayExpression} arr
 * @returns {boolean}
 */
function containsAtomRecord(arr) {
  return arr.elements.some(
    el =>
      el !== null &&
      el.type === 'ObjectExpression' &&
      hasStringProp(el, 'key') &&
      hasStringProp(el, 'supportStatus'),
  )
}

/**
 * 深度搜索 node 树中第一个符合 atom record 结构的 ArrayExpression。
 * 用于 new Map([[key, atomRecord], ...]) 场景。
 * @param {import('estree').Node} node
 * @param {number} depth
 * @returns {boolean}
 */
function containsAtomRecordDeep(node, depth = 0) {
  if (depth > 4) return false
  if (!node || typeof node !== 'object') return false
  if (node.type === 'ArrayExpression' && containsAtomRecord(node)) return true
  // 遍历直接子节点
  for (const val of Object.values(node)) {
    if (Array.isArray(val)) {
      for (const child of val) {
        if (child && typeof child === 'object' && child.type && containsAtomRecordDeep(child, depth + 1)) return true
      }
    }
    else if (val && typeof val === 'object' && val.type) {
      if (containsAtomRecordDeep(val, depth + 1)) return true
    }
  }
  return false
}

/**
 * 判断声明节点是否在函数内部（反向排除，替代 ancestors.length 判断）。
 * @param {import('estree').Node[]} ancestors
 * @returns {boolean}
 */
function isInsideFunction(ancestors) {
  return ancestors.some(
    a =>
      a.type === 'FunctionDeclaration' ||
      a.type === 'FunctionExpression' ||
      a.type === 'ArrowFunctionExpression',
  )
}

/** @type {import('eslint').Rule.RuleModule} */
const rule = {
  meta: {
    type: 'problem',
    docs: {
      description: '禁止在 llm-strategy-codegen 内新建第二个 atom 数据源（Issue #1334 AC-8，structural 检测）',
      recommended: false,
    },
    schema: [],
    messages: {
      noAtomRecordArray:
        'Issue #1334 AC-8: 检测到 atom record 数组（含 key + supportStatus 字符串字段）。'
        + ' atom 元数据唯一真相源为 ATOM_CONTRACT_REGISTRY；'
        + ' 如需精确覆盖请迁入注册表，适配层变更须在 semantic-atom-registry.service.ts（STANDALONE_ATOM_MAP）进行。'
        + ' 若此处是真相源/fixture/测试，请将文件加入 eslint.config.js 的 ignores allowlist。',
      noForeignAtomImport:
        'Issue #1334 AC-8: 禁止从非 atom-contract-registry 文件引入 ATOM_* 符号 "{{ name }}"。'
        + ' 统一从 atom-contracts/atom-contract-registry 导入。',
    },
  },
  create(context) {
    return {
      VariableDeclarator(node) {
        // 排除函数内部声明（局部变量不属于模块级 atom 数据源）
        const ancestors = context.sourceCode
          ? context.sourceCode.getAncestors(node)
          : context.getAncestors()
        if (isInsideFunction(ancestors)) return

        const init = node.init
        if (!init) return

        // 情形 1: 直接 ArrayExpression 含 atom record
        if (init.type === 'ArrayExpression' && containsAtomRecord(init)) {
          context.report({ node, messageId: 'noAtomRecordArray' })
          return
        }

        // 情形 2: new Map([...]) 中嵌套 atom record（深度搜索 ≤4 层）
        if (
          init.type === 'NewExpression' &&
          init.callee.type === 'Identifier' &&
          init.callee.name === 'Map' &&
          containsAtomRecordDeep(init)
        ) {
          context.report({ node, messageId: 'noAtomRecordArray' })
        }
      },

      ImportDeclaration(node) {
        const source = node.source.value
        if (typeof source !== 'string') return
        if (source.includes('atom-contract-registry')) return

        for (const specifier of node.specifiers) {
          if (
            specifier.type === 'ImportSpecifier' &&
            specifier.imported.name.startsWith('ATOM_')
          ) {
            context.report({
              node: specifier,
              messageId: 'noForeignAtomImport',
              data: { name: specifier.imported.name },
            })
          }
        }
      },
    }
  },
}

export default rule
