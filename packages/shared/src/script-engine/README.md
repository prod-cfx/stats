# Script Engine

安全的 JavaScript 脚本执行引擎，提供沙箱环境来执行用户自定义脚本。

## ⚠️ 重要安全警告

**Node.js `vm` 模块无法提供完全安全的沙箱隔离！**

虽然此模块实现了多层安全措施，但 Node.js 的 `vm` 模块存在已知的逃逸方式。**不要用于执行不受信任的代码**。

### 已知安全限制

1. **Function Constructor 逃逸**: 通过 `(() => {}).constructor('return process')()` 等方式可能访问宿主环境
2. **原型链污染**: 恶意脚本可能污染宿主对象的原型
3. **资源耗尽**: 虽然有超时控制，但恶意脚本仍可能占用大量内存

### 推荐使用场景

✅ **适合**:
- 执行可信用户（内部员工）的脚本
- 作为开发/测试环境的快速原型
- 配合严格的代码审查流程

❌ **不适合**:
- 执行来自互联网的任意代码
- 多租户环境的用户脚本执行
- 高安全要求的生产环境

### 生产级安全方案

对于需要执行不受信任代码的场景，建议使用：
- [`isolated-vm`](https://github.com/laverdet/isolated-vm): V8 isolates 提供真正的隔离
- Worker Threads: Node.js 原生支持，进程级隔离
- 容器化: Docker/Kubernetes 沙箱
- WebAssembly: WASI 沙箱环境

## 特性

- ✅ **沙箱隔离**: 使用 Node.js VM 模块提供安全的执行环境
- ✅ **超时控制**: 防止脚本无限执行
- ✅ **上下文注入**: 安全地向脚本传递数据和函数
- ✅ **语法验证**: 执行前验证脚本语法和危险模式
- ✅ **日志捕获**: 捕获脚本的 console 输出
- ✅ **错误处理**: 完整的错误信息和堆栈跟踪
- ✅ **异步支持**: 支持异步脚本执行
- ✅ **执行统计**: 返回执行时间等统计信息

## 安装

此模块已包含在 `@ai/shared` 包中，无需单独安装。

## 基本使用

### 创建引擎实例

```typescript
import { createScriptEngine } from '@ai/shared/node'

const engine = createScriptEngine()
```

### 执行简单脚本

```typescript
const result = await engine.execute('1 + 2')

console.log(result.success) // true
console.log(result.value)   // 3
console.log(result.executionTime) // 执行时间（毫秒）
```

### 使用上下文

```typescript
const result = await engine.execute(
  'price * quantity',
  {
    context: {
      price: 100,
      quantity: 5
    }
  }
)

console.log(result.value) // 500
```

### 注入函数

```typescript
const result = await engine.execute(
  'calculateTotal(items)',
  {
    context: {
      items: [10, 20, 30],
      calculateTotal: (arr: number[]) => arr.reduce((a, b) => a + b, 0)
    }
  }
)

console.log(result.value) // 60
```

## 高级用法

### 超时控制

```typescript
const result = await engine.execute(
  'while(true) {}', // 无限循环
  {
    timeout: 1000 // 1秒超时
  }
)

console.log(result.success) // false
console.log(result.error?.message) // 'Script execution timed out.'
```

### 捕获日志

```typescript
const result = await engine.execute(`
  console.log('Step 1');
  console.warn('Warning message');
  console.error('Error message');
  return 'done';
`)

console.log(result.logs)
// [
//   '[log] Step 1',
//   '[warn] Warning message',
//   '[error] Error message'
// ]
```

### 异步执行

```typescript
const result = await engine.execute(
  `
  const data = await fetchData();
  return data.result;
  `,
  {
    allowAsync: true,
    context: {
      fetchData: async () => ({ result: 42 })
    }
  }
)

console.log(result.value) // 42
```

### 脚本验证

在执行前验证脚本：

```typescript
const validation = engine.validate('const x = 1 + 2')

console.log(validation.valid) // true
console.log(validation.errors) // undefined
console.log(validation.warnings) // undefined
```

检测危险模式：

```typescript
const validation = engine.validate('require("fs")')

console.log(validation.valid) // false
console.log(validation.errors) // ['require() is not allowed']
```

## 安全特性

### Context 注入限制

**⚠️ 重要安全约束：不允许注入函数**

为防止沙箱逃逸，context 中**只允许**以下类型：
- ✅ 基本类型：`string`, `number`, `boolean`, `null`, `undefined`
- ✅ 纯数据对象：`{ key: value }`
- ✅ 数组：`[1, 2, 3]`

**禁止**注入函数：
```typescript
// ❌ 错误 - 会抛出异常
await engine.execute('add(1, 2)', {
  context: {
    add: (a, b) => a + b  // Functions are not allowed!
  }
})
// Error: Functions are not allowed in context

// ❌ 嵌套函数也不允许
await engine.execute('obj.fn()', {
  context: {
    obj: { fn: () => 'test' }  // Nested functions are not allowed!
  }
})
```

**原因**：宿主的函数对象可以通过 `.constructor` 属性访问到宿主环境：
```typescript
// 如果允许函数注入，攻击者可以这样逃逸沙箱：
add.constructor('return process')()  // 访问宿主 process
```

### 禁止的操作

脚本引擎会阻止以下危险操作：

- ❌ `require()` - 禁止加载模块
- ❌ `import` - 禁止 ES 模块导入
- ❌ `process` - 禁止访问进程对象
- ❌ `eval()` - 禁止动态代码执行
- ❌ `Function()` - 禁止函数构造器
- ❌ `__dirname` / `__filename` - 禁止访问文件系统路径

### 允许的全局对象

脚本可以访问以下安全的全局对象：

- ✅ `Object`, `Array`, `String`, `Number`, `Boolean`
- ✅ `Date`, `Math`, `JSON`, `RegExp`
- ✅ `Error` 及其子类
- ✅ `parseInt`, `parseFloat`, `isNaN`, `isFinite`
- ✅ URI 编解码函数

### 沙箱隔离

```typescript
// 脚本无法访问外部变量
const secretKey = 'my-secret'

const result = await engine.execute('typeof secretKey')

console.log(result.value) // 'undefined' - 无法访问
```

## API 参考

### ScriptEngine

#### `execute<T>(code: string, options?: ScriptExecutionOptions): Promise<ScriptExecutionResult<T>>`

执行 JavaScript 脚本。

**参数：**

- `code`: 要执行的 JavaScript 代码
- `options`: 执行选项
  - `timeout?: number` - 超时时间（毫秒），默认 5000
  - `context?: ScriptContext` - 注入的上下文数据
  - `strict?: boolean` - 是否使用严格模式，默认 true
  - `console?: Console` - 自定义 console 实现
  - `allowAsync?: boolean` - 是否允许异步代码，默认 false

**返回：**

- `ScriptExecutionResult<T>` - 执行结果
  - `success: boolean` - 是否成功
  - `value?: T` - 返回值
  - `error?: { message, stack, name }` - 错误信息
  - `executionTime: number` - 执行时间（毫秒）
  - `logs?: string[]` - 日志输出

#### `validate(code: string): ScriptValidationResult`

验证脚本语法和安全性。

**参数：**

- `code`: 要验证的 JavaScript 代码

**返回：**

- `ScriptValidationResult` - 验证结果
  - `valid: boolean` - 是否有效
  - `errors?: string[]` - 错误列表
  - `warnings?: string[]` - 警告列表

## 使用场景示例

### 1. 计算引擎

```typescript
// 价格计算
const result = await engine.execute(
  `
  const basePrice = price * quantity;
  const discount = basePrice * discountRate;
  const tax = (basePrice - discount) * taxRate;
  return basePrice - discount + tax;
  `,
  {
    context: {
      price: 100,
      quantity: 5,
      discountRate: 0.1,
      taxRate: 0.08
    }
  }
)
```

### 2. 数据转换

```typescript
// 数据处理
const result = await engine.execute(
  `
  return data
    .filter(item => item.status === 'active')
    .map(item => ({
      id: item.id,
      total: item.price * item.quantity
    }))
    .reduce((sum, item) => sum + item.total, 0);
  `,
  {
    context: {
      data: [
        { id: 1, status: 'active', price: 10, quantity: 2 },
        { id: 2, status: 'inactive', price: 20, quantity: 1 },
        { id: 3, status: 'active', price: 15, quantity: 3 }
      ]
    }
  }
)
```

### 3. 条件判断

```typescript
// 业务规则判断
const result = await engine.execute(
  `
  if (user.age < 18) {
    return 'minor';
  } else if (user.age >= 18 && user.age < 65) {
    return 'adult';
  } else {
    return 'senior';
  }
  `,
  {
    context: {
      user: { age: 30 }
    }
  }
)
```

### 4. 自定义验证

```typescript
// 自定义验证逻辑
const result = await engine.execute(
  `
  const errors = [];
  
  if (!email.includes('@')) {
    errors.push('Invalid email format');
  }
  
  if (password.length < 8) {
    errors.push('Password too short');
  }
  
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
  `,
  {
    context: {
      email: 'test@example.com',
      password: 'secure123'
    }
  }
)
```

## 注意事项

1. **性能考虑**: 虽然使用了沙箱隔离，但频繁执行复杂脚本仍会影响性能
2. **内存限制**: Node.js VM 模块有内存限制，避免处理过大的数据集
3. **错误处理**: 始终检查 `result.success` 并处理可能的错误
4. **超时设置**: 根据脚本复杂度合理设置超时时间
5. **上下文安全**: 不要在上下文中传递敏感数据或不可信的函数

## 最佳实践

1. **预验证**: 在执行前使用 `validate()` 方法验证脚本
2. **错误处理**: 总是处理执行失败的情况
3. **超时控制**: 为所有脚本设置合理的超时时间
4. **日志记录**: 在生产环境中记录脚本执行日志
5. **测试**: 充分测试自定义脚本的各种边界情况

## 测试

运行测试：

```bash
dx test e2e backend
```

## License

MIT
