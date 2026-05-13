/**
 * RuleTester for no-business-rule-in-dispatcher (AC-13).
 *
 * 设计取舍说明：
 *   - 本规则只检查**字面量**比较（'trigger' / 'action' / ...）。
 *   - trivial 重写绕过（`const k = 'trigger'; if (bucket === k)`）已知可绕——
 *     需要符号 tracking 才能 catch，超出 ESLint flat plugin 单文件 AST 扫描能力。
 *     由 PR review 流程 + AC-13 文档化 known limitation 兜底。
 *   - 规则 enable 域是 `services/generic-seed-dispatcher*.ts` glob（review M1：
 *     防止挪到 dispatcher-utils.ts 等新文件跳过守门）；本 spec 不验启用域，
 *     由 eslint.config.js 自身配置承担。
 *
 * 跑：node --test eslint-rules/__tests__/no-business-rule-in-dispatcher.spec.js
 */
import { RuleTester } from 'eslint'
import rule from '../no-business-rule-in-dispatcher.js'

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
})

ruleTester.run('no-business-rule-in-dispatcher', rule, {
  valid: [
    // 数组 callback predicate 内的 bucket 比较 — 数据派生表达式（非分流）
    { code: 'arr.filter(([, c]) => c.bucket === \'trigger\')' },
    { code: 'list.map(c => c.bucket === \'action\' ? 1 : 0)' },
    { code: 'arr.some(c => c.bucket === \'risk\')' },
    { code: 'arr.every(c => c.bucket !== \'orchestration\')' },
    { code: 'arr.find(c => c.bucket === \'positionConstraint\')' },
    { code: 'arr.findIndex(c => c.bucket === \'position\')' },
    { code: 'arr.reduce((acc, c) => c.bucket === \'trigger\' ? acc + 1 : acc, 0)' },
    // lookup table 派生（合法）
    { code: 'const slot = BUCKET_TO_PATCH_SLOT[contract.bucket]' },
    // 非 bucket 字面量比较（其它字符串不阻断）
    { code: 'if (status === \'ready\') {}' },
    { code: 'if (kind === \'foo\') {}' },
    // 等号 / 非等号 算子之外（不应触发）
    { code: 'if (bucket && bucket.length > 0) {}' },
    // identifier 比较（known bypass，文档化承认；不触发，留 PR review 把守）
    { code: 'const TRIGGER = \'trigger\'; if (bucket === TRIGGER) {}' },
  ],
  invalid: [
    // 直接 if 字面量分流
    {
      code: 'if (bucket === \'trigger\') {}',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    {
      code: 'if (\'action\' === contract.bucket) {}',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    {
      code: 'if (bucket !== \'risk\') {}',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    {
      code: 'if (bucket == \'orchestration\') {}',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    // template literal（无插值）形式
    {
      code: 'if (bucket === `positionConstraint`) {}',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    // ternary 三元表达式
    {
      code: 'const slot = bucket === \'trigger\' ? \'triggers\' : \'others\'',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    // chained &&（嵌套 BinaryExpression 也应被各自捕获）
    {
      code: 'if (bucket === \'trigger\' && other) {}',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    // switch case
    {
      code: 'switch (bucket) { case \'trigger\': break; }',
      errors: [{ messageId: 'noBucketSwitch' }],
    },
    {
      code: 'switch (b) { case \'action\': break; case \'risk\': break; }',
      errors: [
        { messageId: 'noBucketSwitch' },
        { messageId: 'noBucketSwitch' },
      ],
    },
    // 在普通函数内（非 array callback）也应触发
    {
      code: 'function f(bucket) { if (bucket === \'trigger\') return 1 }',
      errors: [{ messageId: 'noBucketBranch' }],
    },
    // 在普通 callback（非 array method）也应触发
    {
      code: 'somePromise.then(bucket => { if (bucket === \'trigger\') {} })',
      errors: [{ messageId: 'noBucketBranch' }],
    },
  ],
})

console.log('no-business-rule-in-dispatcher: all RuleTester cases passed')
