# JavaScript 执行引擎 - 快速入门

## 安装

该模块已集成在 `@ai/shared` 包中，无需额外安装。

```typescript
import { createScriptEngine } from '@ai/shared/node'
```

## 5 分钟快速上手

### 1. 创建引擎实例

```typescript
const engine = createScriptEngine()
```

### 2. 执行简单脚本

```typescript
const result = await engine.execute('1 + 2')
console.log(result.value) // 3
```

### 3. 使用变量上下文

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

### 4. 执行复杂逻辑

```typescript
const result = await engine.execute(
  `
  items
    .filter(item => item.active)
    .map(item => item.price * item.qty)
    .reduce((sum, total) => sum + total, 0)
  `,
  {
    context: {
      items: [
        { active: true, price: 10, qty: 2 },
        { active: false, price: 20, qty: 1 },
        { active: true, price: 15, qty: 3 }
      ]
    }
  }
)
console.log(result.value) // 65
```

### 5. 注入自定义函数

```typescript
const result = await engine.execute(
  'calculateDiscount(price, discountRate)',
  {
    context: {
      price: 1000,
      discountRate: 0.2,
      calculateDiscount: (p: number, rate: number) => p * (1 - rate)
    }
  }
)
console.log(result.value) // 800
```

## 常见用例

### 价格计算器

```typescript
const calculatePrice = async (items: any[], taxRate: number, discount: number) => {
  const result = await engine.execute(
    `
    (function() {
      const subtotal = items.reduce((sum, item) => 
        sum + item.price * item.quantity, 0
      );
      const afterDiscount = subtotal * (1 - discount);
      const tax = afterDiscount * taxRate;
      return {
        subtotal,
        discount: subtotal - afterDiscount,
        tax,
        total: afterDiscount + tax
      };
    })()
    `,
    {
      context: { items, taxRate, discount }
    }
  )
  return result.value
}
```

### 条件规则引擎

```typescript
const checkEligibility = async (user: any) => {
  const result = await engine.execute(
    `
    (function() {
      if (user.age < 18) return { eligible: false, reason: 'Too young' };
      if (user.income < 30000) return { eligible: false, reason: 'Income too low' };
      if (user.credit < 600) return { eligible: false, reason: 'Credit score too low' };
      return { eligible: true, reason: 'Eligible' };
    })()
    `,
    {
      context: { user }
    }
  )
  return result.value
}
```

### 数据转换器

```typescript
const transformData = async (data: any[]) => {
  const result = await engine.execute(
    `
    data.map(item => ({
      id: item.id,
      fullName: item.firstName + ' ' + item.lastName,
      displayEmail: item.email.replace(/(.{3}).*(@.*)/, '$1***$2'),
      age: new Date().getFullYear() - new Date(item.birthDate).getFullYear()
    }))
    `,
    {
      context: { data }
    }
  )
  return result.value
}
```

## 错误处理

```typescript
const result = await engine.execute(code, { context })

if (!result.success) {
  console.error('Execution failed:', result.error?.message)
  console.error('Stack:', result.error?.stack)
  return
}

console.log('Result:', result.value)
console.log('Execution time:', result.executionTime, 'ms')
```

## 安全最佳实践

1. **始终验证脚本**
```typescript
const validation = engine.validate(code)
if (!validation.valid) {
  console.error('Invalid script:', validation.errors)
  return
}
```

2. **设置合理的超时**
```typescript
const result = await engine.execute(code, {
  timeout: 3000 // 3 秒超时
})
```

3. **不要在上下文中传递敏感数据**
```typescript
// ❌ 不好
const result = await engine.execute(code, {
  context: {
    apiKey: process.env.API_KEY, // 敏感信息
    password: user.password       // 敏感信息
  }
})

// ✅ 好
const result = await engine.execute(code, {
  context: {
    userId: user.id,
    userName: user.name
  }
})
```

4. **限制脚本来源**
- 只执行受信任来源的脚本
- 对用户提交的脚本进行严格审查
- 考虑实现脚本白名单机制

## 更多信息

- 详细文档：[README.md](./README.md)
- 实现文档：[IMPLEMENTATION.md](./IMPLEMENTATION.md)
- 使用示例：[examples.ts](./examples.ts)
- 单元测试：[../__tests__/script-engine.test.ts](../__tests__/script-engine.test.ts)
