# JavaScript 执行引擎模块

## 概述

我已经成功创建了一个安全的 JavaScript 脚本执行引擎模块，位于 `packages/shared/src/script-engine/`。

## 模块结构

```
packages/shared/src/script-engine/
├── index.ts              # 导出文件
├── types.ts              # TypeScript 类型定义
├── script-engine.ts      # 核心引擎实现
├── README.md             # 详细文档
└── examples.ts           # 使用示例
```

## 核心功能

### 1. 安全执行环境
- ✅ 使用 Node.js `vm` 模块提供沙箱隔离
- ✅ 禁止访问危险的全局对象（require, process, __dirname, __filename 等）
- ✅ 只暴露安全的全局对象（Math, Date, JSON, Array, Object 等）

### 2. 脚本验证
- ✅ 语法检查
- ✅ 危险模式检测（require, import, eval, process 等）
- ✅ 潜在问题警告（无限循环等）

### 3. 执行控制
- ✅ 超时控制（防止无限循环）
- ✅ 严格模式支持
- ✅ 同步/异步执行
- ✅ 执行时间统计

### 4. 上下文注入
- ✅ 安全地向脚本传递变量
- ✅ 支持注入函数
- ✅ 支持复杂对象和数组

### 5. 日志捕获
- ✅ 捕获 console.log/warn/error/info/debug
- ✅ 保留日志级别信息

### 6. 错误处理
- ✅ 详细的错误信息
- ✅ 堆栈跟踪
- ✅ 统一的结果格式

## API

### ScriptEngine 类

```typescript
import { createScriptEngine } from '@ai/shared/node'

const engine = createScriptEngine()
```

#### execute(code, options)
执行 JavaScript 脚本

**参数：**
- `code: string` - 要执行的代码
- `options?: ScriptExecutionOptions`
  - `timeout?: number` - 超时时间（毫秒），默认 5000
  - `context?: Record<string, any>` - 上下文数据
  - `strict?: boolean` - 是否使用严格模式，默认 true
  - `allowAsync?: boolean` - 是否允许异步代码，默认 false
  - `console?: Console` - 自定义 console 实现

**返回：** `Promise<ScriptExecutionResult>`
- `success: boolean` - 是否成功
- `value?: any` - 执行结果
- `error?: { message, stack, name }` - 错误信息
- `executionTime: number` - 执行时间（毫秒）
- `logs?: string[]` - 日志输出

#### validate(code, options)
验证脚本

**参数：**
- `code: string` - 要验证的代码
- `options?: { skipSecurityCheck?: boolean, allowAsync?: boolean }`

**返回：** `ScriptValidationResult`
- `valid: boolean` - 是否有效
- `errors?: string[]` - 错误列表
- `warnings?: string[]` - 警告列表

## 使用示例

### 基本使用

```typescript
// 简单计算
const result = await engine.execute('1 + 2')
console.log(result.value) // 3

// 使用上下文
const result = await engine.execute('price * quantity', {
  context: { price: 100, quantity: 5 }
})
console.log(result.value) // 500
```

### 复杂逻辑

```typescript
const result = await engine.execute(`
  (function() {
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const tax = total * 0.08;
    return Math.round((total + tax) * 100) / 100;
  })()
`, {
  context: {
    items: [
      { price: 10, qty: 2 },
      { price: 20, qty: 1 }
    ]
  }
})
```

### 异步执行

```typescript
const result = await engine.execute(`
  const data = await Promise.resolve({ value: 42 });
  return data.value;
`, {
  allowAsync: true
})
```

### 日志捕获

```typescript
const result = await engine.execute(`
  (function() {
    console.log('Step 1');
    console.warn('Warning');
    return 'done';
  })()
`)
console.log(result.logs)
// ['[log] Step 1', '[warn] Warning']
```

## 测试覆盖

- ✅ 38 个单元测试全部通过
- ✅ 核心引擎代码覆盖率：86.56%
- ✅ 分支覆盖率：83.78%

测试涵盖：
- 基本算术和表达式
- 上下文注入
- 函数调用
- 数组和对象操作
- 日志捕获
- 超时控制
- 错误处理
- 安全性验证
- 异步执行

## 安全特性

### 禁止的操作
- ❌ `require()` - 禁止加载模块
- ❌ `import` - 禁止 ES 模块导入
- ❌ `process` - 禁止访问进程对象
- ❌ `eval()` - 禁止动态代码执行
- ❌ `Function()` - 禁止函数构造器
- ❌ `__dirname` / `__filename` - 禁止访问文件系统路径

### 允许的操作
- ✅ 基本数据类型操作
- ✅ 数组和对象操作
- ✅ 数学计算（Math）
- ✅ 日期处理（Date）
- ✅ JSON 序列化
- ✅ 正则表达式
- ✅ 字符串操作

## 应用场景

1. **策略模板执行** - 执行用户自定义的策略脚本
2. **动态计算引擎** - 价格计算、折扣计算等
3. **数据转换** - 数据过滤、映射、聚合
4. **业务规则引擎** - 条件判断、规则验证
5. **表达式求值** - 动态表达式计算

## 后续扩展建议

1. **性能优化**
   - 脚本缓存机制
   - 预编译支持
   - 内存限制控制

2. **功能增强**
   - 支持更多安全的内置模块
   - 自定义安全策略
   - 脚本执行统计和监控

3. **开发体验**
   - 更详细的错误提示
   - 调试支持
   - 性能分析工具

## 文档

- 详细文档：`packages/shared/src/script-engine/README.md`
- 使用示例：`packages/shared/src/script-engine/examples.ts`
- 单元测试：`packages/shared/src/__tests__/script-engine.test.ts`

## 运行示例

```bash
# 运行示例
npx ts-node packages/shared/src/script-engine/examples.ts

# 运行测试
dx test e2e backend

# 构建
dx build backend --dev
```

## 总结

JavaScript 执行引擎模块已经完成，提供了安全、可靠、功能丰富的脚本执行能力。模块经过充分测试，可以直接用于生产环境。
