# CEX API Key 验证 E2E 测试

## 概述

这个 E2E 测试套件覆盖中心化交易所（Binance / OKX）API Key 验证相关流程，包括：

- 成功验证场景
- 常见错误场景（无效 Key、IP 限制、权限不足等）
- 权限控制和安全校验
- DTO / 表单验证
- 边界情况和并发请求

## 测试覆盖

### Binance

1. 成功场景
   - 创建现货账户（Spot）
   - 创建合约账户（Futures）
   - 校验响应结构
2. 错误场景
   - 无效 API Key
   - 错误 Secret（签名验证失败）
   - IP 白名单限制
   - API Key 被禁用
   - 权限不足（未开启交易权限）

### OKX

1. 成功场景
   - 创建现货 / 合约账户
   - 校验响应包含 `lastValidatedAt` 时间戳
2. 错误场景
   - 无效 API Key
   - 过期 API Key（包含 14 天提示）
   - 错误 Passphrase
   - IP 白名单限制
   - 权限不足
   - API Key 被禁用或删除
   - 缺少 Passphrase（DTO 验证）

### 其他

1. 列表与删除
   - 获取用户交易所账户列表
   - 删除账户
   - 确认不会泄露敏感信息
   - 验证用户隔离
2. 输入验证
   - 必填字段验证
   - 枚举值验证
   - 长度限制
3. 边界情况
   - 并发请求处理
   - 最大长度账户名
   - 超长名称拒绝

## Mock 策略

测试通过 `globalThis.fetch` mock 拦截交易所 API 请求，避免访问真实交易所。

### Binance Mock

```ts
// 正常响应
apiKey: 'valid_key' + valid signature -> 200 OK with balance

// 错误响应
apiKey: 'invalid_key' -> 400 with code -2015
apiKey: 'wrong_secret' -> 400 with code -1022
apiKey: 'ip_restricted' -> 403 with code -2010
apiKey: 'disabled_key' -> 403 with code -2011
apiKey: 'no_permission' -> 403 with code -2015 + permission msg
```

### OKX Mock

```ts
// 正常响应
apiKey: 'valid_key' + passphrase: 'valid_passphrase' -> 200 OK

// 错误响应
apiKey: 'invalid_key' -> 401 with code '50113'
apiKey: 'expired_key' -> 401 with code '50114'
passphrase: 'wrong_passphrase' -> 401 with code '50111'
apiKey: 'ip_restricted' -> 403 with code '50112'
apiKey: 'no_permission' -> 403 with code '51001'
apiKey: 'disabled_key' -> 403 with code '50115'
```

## 运行测试

### 前提条件

```bash
# 1. 准备 E2E 环境变量
cp .env.example .env.e2e
# 编辑 .env.e2e，确保 DATABASE_URL 指向测试数据库

# 2. 同步当前 schema
dx db deploy --e2e
```

### 运行全部 E2E

```bash
dx test e2e quantify apps/quantify/e2e/exchange-accounts
```

### 运行当前套件

```bash
dx test e2e quantify apps/quantify/e2e/exchange-accounts
```

### 运行指定文件

```bash
# 或指定完整路径
dx test e2e quantify apps/quantify/e2e/exchange-accounts

dx test e2e quantify apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts
```

### 运行特定测试

```bash
# 运行 Binance 相关测试
dx test e2e quantify apps/quantify/e2e/exchange-accounts -t "Binance"

# 运行 OKX 相关测试
dx test e2e quantify apps/quantify/e2e/exchange-accounts -t "OKX"

# 运行错误场景测试
dx test e2e quantify apps/quantify/e2e/exchange-accounts -t "should reject"
```

### 调试模式

```bash
# 启用详细日志
E2E_VERBOSE_LOG=true dx test e2e quantify apps/quantify/e2e/exchange-accounts

# 直接使用 jest 调试
node --inspect-brk node_modules/.bin/jest --config apps/quantify/e2e/jest-e2e.json exchange-accounts.e2e-spec.ts
```

## 测试数据清理

测试结束后会自动清理数据：

1. 测试用户：在 `afterAll` 钩子中删除
2. 交易所账户：通过外键级联删除
3. 测试数据库：由 [`setup-e2e.ts`](../setup-e2e.ts) 在测试结束后删除

## 故障排查

### 测试超时

```bash
jest --testTimeout=60000
```

### 数据库连接异常

```bash
echo "$DATABASE_URL"
psql "$DATABASE_URL" -c "SELECT 1"
```

### Mock 未生效

检查 `beforeAll` 是否成功执行：

```ts
console.log('Fetch is mocked:', typeof globalThis.fetch === 'function')
```

## 扩展测试

### 添加新的错误场景

1. 在 mock fetch 中新增错误码分支
2. 增加对应断言用例

### 添加性能测试

```ts
describe('Performance', () => {
  it('should validate credentials within 5 seconds', async () => {
    const start = Date.now()

    await createApiClient(app, userToken)
      .post('exchange-accounts')
      .send({
        exchangeId: 'binance',
        apiKey: 'valid_key',
        apiSecret: 'valid_secret',
        marketType: 'spot',
      })
      .expect(201)

    expect(Date.now() - start).toBeLessThan(5000)
  })
})
```

## 相关文档

- [Jest E2E 配置](../jest-e2e.json)
- [测试夹具](../fixtures/fixtures.ts)

## 维护清单

- [ ] 定期更新交易所错误码映射
- [ ] 监控真实环境中的错误分布
- [ ] 根据用户反馈补充测试场景
- [ ] 保持 mock 响应与真实 API 一致
- [ ] 更新文档以反映最新覆盖范围

## 贡献指南

添加新测试时，请确保：

1. 测试名称清晰描述测试内容
2. 使用正确的 HTTP 状态码断言
3. 验证错误消息中的关键内容
4. 做好测试数据清理
5. 同步更新 README
