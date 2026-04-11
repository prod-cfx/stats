# Script Engine

基于 Node.js `vm` 的脚本执行引擎，用于在后端执行受限 JavaScript。

## 导入方式

- Node 环境推荐从 `@ai/shared/script-engine` 或 `@ai/shared/node` 导入
- `@ai/shared` 根导出刻意不直接暴露 `script-engine`，避免浏览器侧误用

```ts
import { createScriptEngine } from '@ai/shared/script-engine'

const engine = createScriptEngine()
```

## 当前能力

- 在 `vm` 上下文中执行同步或异步脚本
- 执行前做语法校验与危险模式校验
- 捕获 `console` 输出
- 支持超时控制
- 返回统一的执行结果：`success / value / error / executionTime / logs`

## 安全边界

**Node.js `vm` 不是强隔离沙箱。不要用于执行不受信任代码。**

当前实现会尽量降低风险，但仍然只适合：

- 内部可信脚本
- 开发、测试、受控运营场景
- 已经过业务审核的策略脚本

不适合：

- 来自互联网的任意代码
- 多租户隔离执行
- 高安全级别生产沙箱

## 真实约束

`engine.execute()` 的 `context` 不允许直接注入宿主函数。

```ts
await engine.execute('add(1, 2)', {
  context: {
    add: (a, b) => a + b,
  },
})
// => Context injection error: Functions are not allowed in context
```

这样做是为了避免通过函数对象的 `.constructor` 等路径逃逸到宿主环境。

如果脚本需要辅助函数，应该通过 [helpers/context-builder.ts](helpers/context-builder.ts) 提供的上下文构建器注入 `helpers` 命名空间。该命名空间会先经过 [helpers/safe-helpers.ts](helpers/safe-helpers.ts) 包装和冻结，而不是直接把宿主函数裸传入上下文。

## 基本用法

### 执行简单脚本

```ts
const result = await engine.execute('1 + 2')

console.log(result.success) // true
console.log(result.value) // 3
```

### 传入纯数据上下文

```ts
const result = await engine.execute('price * quantity', {
  context: {
    price: 100,
    quantity: 5,
  },
})
```

### 允许异步脚本

```ts
const result = await engine.execute(
  `
  const payload = await Promise.resolve({ result: value })
  return payload.result
  `,
  {
    allowAsync: true,
    context: {
      value: 42,
    },
  },
)
```

注：如果确实需要脚本内调用函数，请走预包装过的 `helpers`，不要自己把宿主函数塞进 `context`。

### 捕获日志

```ts
const result = await engine.execute(`
  console.log('step 1')
  return 'done'
`)

console.log(result.logs)
```

## API 概览

### `createScriptEngine()`

创建 `ScriptEngine` 实例。

### `engine.execute(code, options)`

常用选项：

- `timeout?: number`
- `context?: Record<string, unknown>`
- `strict?: boolean`
- `console?: Console`
- `allowAsync?: boolean`

### `engine.validate(code, options?)`

执行前校验脚本，当前会检查：

- 空脚本
- 语法错误
- `require()`
- `import`
- `process.`
- `__dirname` / `__filename`
- `eval()`
- `Function()`

同时会对明显无限循环给出 warning。

## 与策略脚本的关系

量化策略场景通常不要手写原始 `context`，而是使用：

- [helpers/README.md](helpers/README.md)
- [QUICKSTART.md](QUICKSTART.md)
- [IMPLEMENTATION.md](IMPLEMENTATION.md)

典型方式：

```ts
import { createScriptEngine } from '@ai/shared/script-engine'
import { buildStrategyContext } from '@ai/shared/script-engine/helpers'

const engine = createScriptEngine()
const context = buildStrategyContext({
  bars,
  symbol: 'BTCUSDT',
  timeframe: '1h',
  indicators: {},
  currentPrice: 65000,
})

const result = await engine.execute(strategyScript, { context, timeout: 5000 })
```

这里展示的是当前公开可直接导入的兼容入口。
如果你在维护多 leg / 多周期策略链路，需要继续参考 `helpers/context-builder.ts` 里的 `buildMultiLegStrategyContext()` 设计，而不是把 `buildStrategyContext()` 当成唯一主路径。
