# Hyperliquid API 集成方案

## 一、API 端点调研总结

### 1.1 核心 API 端点

所有 API 请求均通过 `POST https://api.hyperliquid.xyz/info` 发送，使用 `type` 参数区分端点。

| 端点类型 | 用途 | 请求参数 | 数据完整性 | 权重 |
|---------|------|---------|----------|------|
| `clearinghouseState` | 获取用户永续合约账户快照 | `user` (地址) | ✅ 完整 | 2 |
| `spotClearinghouseState` | 获取用户现货账户快照 | `user` (地址) | ✅ 完整 | - |
| `openOrders` | 获取用户当前挂单 | `user` (地址) | ✅ 完整 | - |
| `userFills` | 获取用户成交记录（最多 2000 条） | `user` (地址), `aggregateByTime` | ✅ 完整 | 0.05/条 |
| `userFillsByTime` | 按时间范围获取成交记录 | `user`, `startTime`, `endTime` | ✅ 完整 | 0.05/条 |
| `userFunding` | 获取用户资金费率历史 | `user`, `startTime`, `endTime` | ✅ 完整 | 0.05/条 |
| `historicalOrders` | 获取历史订单（最多 2000 条） | `user` (地址) | ✅ 完整 | 0.05/条 |
| `userNonFundingLedgerUpdates` | 获取非资金费用账本变动（充值/提现/转账） | `user`, `startTime`, `endTime` | ✅ 完整 | - |

### 1.2 关键响应字段

#### clearinghouseState 响应结构

```typescript
{
  marginSummary: {
    accountValue: string           // 账户总价值（USD）
    totalNtlPos: string            // 总持仓名义价值
    totalRawUsd: string            // 原始 USD 余额
    totalMarginUsed: string        // 已用保证金
    withdrawable: string           // 可提取金额
  },
  assetPositions: [
    {
      position: {
        coin: string                 // 币种名称
        entryPx: string              // 入场价格
        leverage: {
          type: "cross" | "isolated"
          value: number              // 杠杆倍数
        }
        liquidationPx: string        // 清算价格
        marginUsed: string           // 使用的保证金
        positionValue: string        // 持仓价值
        returnOnEquity: string       // ROI
        szi: string                  // 持仓数量（正=多，负=空）
        unrealizedPnl: string        // 未实现盈亏
      },
      type: "oneWay"
    }
  ],
  crossMarginSummary: {
    accountValue: string
    totalMarginUsed: string
    totalNtlPos: string
    totalRawUsd: string
  },
  withdrawable: string
}
```

#### spotClearinghouseState 响应结构

```typescript
{
  balances: [
    {
      coin: string        // 币种名称，如 "USDC", "PURR"
      token: number       // 代币 ID
      hold: string        // 挂单锁定金额
      total: string       // 总余额
      entryNtl: string    // 入场名义价值
    }
  ]
}
```

#### userFills 响应结构

```typescript
[
  {
    coin: string          // 币种
    px: string            // 成交价格
    sz: string            // 成交数量
    side: string          // 方向（"A" = 主动买入, "B" = 主动卖出）
    time: number          // 时间戳（毫秒）
    startPosition: string // 成交前持仓
    dir: string           // 仓位变化方向
    closedPnl: string     // 已实现盈亏
    hash: string          // 交易哈希
    oid: number           // 订单 ID
    crossed: boolean      // 是否为吃单
    fee: string           // 手续费
    tid: number           // 成交 ID
    liquidation: boolean  // 是否为强平
  }
]
```

#### openOrders 响应结构

```typescript
[
  {
    coin: string          // 币种
    limitPx: string       // 限价
    oid: number           // 订单 ID
    side: string          // 方向（"A" = 买入, "B" = 卖出）
    sz: string            // 数量
    timestamp: number     // 时间戳
    origSz: string        // 原始数量
    cloid?: string        // 客户端订单 ID
    triggerCondition?: string  // 触发条件
    triggerPx?: string    // 触发价格
    orderType?: string    // 订单类型
    reduceOnly?: boolean  // 是否只减仓
  }
]
```

---

## 二、数据库模型设计

### 2.1 账户快照表（按需查询，不持久化）

由于 Hyperliquid API 提供实时查询，**账户快照数据不需要持久化到数据库**，直接通过 API 实时获取即可。这样可以：
- 避免数据不一致问题
- 减少存储成本
- 简化同步逻辑

### 2.2 用户成交历史表（增量同步）

```prisma
/// Hyperliquid 用户成交历史记录
model HyperliquidUserFill {
  id Int @id @default(autoincrement())

  /// 用户地址
  userAddress String @map("user_address")

  /// 币种符号
  coin String

  /// 成交价格
  price Decimal @db.Decimal(30, 10)

  /// 成交数量（正=多，负=空）
  size Decimal @db.Decimal(30, 10)

  /// 方向（A = 主动买入, B = 主动卖出）
  side String

  /// 成交时间
  time DateTime

  /// 成交前持仓数量
  startPosition Decimal @map("start_position") @db.Decimal(30, 10)

  /// 仓位变化方向
  direction String @map("dir")

  /// 已实现盈亏
  closedPnl Decimal @map("closed_pnl") @db.Decimal(30, 10)

  /// 交易哈希
  hash String

  /// 订单 ID
  orderId BigInt @map("order_id") @db.BigInt

  /// 成交 ID
  tradeId BigInt @map("trade_id") @db.BigInt

  /// 是否为吃单
  crossed Boolean

  /// 手续费
  fee Decimal @db.Decimal(30, 10)

  /// 是否为强平
  liquidation Boolean

  /// 数据来源
  source String @default("HYPERLIQUID")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  @@unique([userAddress, coin, time, tradeId], map: "uniq_hyperliquid_user_fill")
  @@index([userAddress, time], map: "idx_hyperliquid_fill_user_time")
  @@index([coin, time], map: "idx_hyperliquid_fill_coin_time")
  @@map("hyperliquid_user_fills")
}
```

### 2.3 用户订单历史表（增量同步）

```prisma
/// Hyperliquid 用户订单历史记录
model HyperliquidUserOrder {
  id Int @id @default(autoincrement())

  /// 用户地址
  userAddress String @map("user_address")

  /// 币种符号
  coin String

  /// 订单 ID
  orderId BigInt @map("order_id") @db.BigInt

  /// 客户端订单 ID（可选）
  clientOrderId String? @map("client_order_id")

  /// 方向（A = 买入, B = 卖出）
  side String

  /// 限价
  limitPrice Decimal @map("limit_price") @db.Decimal(30, 10)

  /// 订单数量
  size Decimal @db.Decimal(30, 10)

  /// 原始数量
  originalSize Decimal @map("original_size") @db.Decimal(30, 10)

  /// 订单类型（limit, market, stop, etc.）
  orderType String? @map("order_type")

  /// 触发价格（止损/止盈订单）
  triggerPrice Decimal? @map("trigger_price") @db.Decimal(30, 10)

  /// 触发条件
  triggerCondition String? @map("trigger_condition")

  /// 是否只减仓
  reduceOnly Boolean? @map("reduce_only")

  /// 订单状态（open, filled, canceled, rejected）
  status String

  /// 订单创建时间
  timestamp DateTime

  /// 数据来源
  source String @default("HYPERLIQUID")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  @@unique([userAddress, orderId], map: "uniq_hyperliquid_user_order")
  @@index([userAddress, timestamp], map: "idx_hyperliquid_order_user_time")
  @@index([status, timestamp], map: "idx_hyperliquid_order_status_time")
  @@map("hyperliquid_user_orders")
}
```

### 2.4 用户资金费率历史表（增量同步）

```prisma
/// Hyperliquid 用户资金费率历史
model HyperliquidUserFunding {
  id Int @id @default(autoincrement())

  /// 用户地址
  userAddress String @map("user_address")

  /// 币种符号
  coin String

  /// 资金费率金额（正=收入，负=支出）
  fundingRate Decimal @map("funding_rate") @db.Decimal(30, 10)

  /// 持仓数量
  szi Decimal @db.Decimal(30, 10)

  /// USDC 金额
  usdc Decimal @db.Decimal(30, 10)

  /// 时间戳
  time DateTime

  /// 数据来源
  source String @default("HYPERLIQUID")

  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  @@unique([userAddress, coin, time], map: "uniq_hyperliquid_user_funding")
  @@index([userAddress, time], map: "idx_hyperliquid_funding_user_time")
  @@map("hyperliquid_user_funding")
}
```

---

## 三、数据同步策略

### 3.1 按需查询策略（推荐）

**适用数据**：账户快照、当前持仓、当前挂单

**原理**：
- 前端请求时直接调用 Hyperliquid API
- 后端作为代理层，添加缓存和限流
- 无需数据库存储

**优点**：
- ✅ 数据实时性最强
- ✅ 无存储成本
- ✅ 无数据一致性问题
- ✅ 实现简单

**缺点**：
- ⚠️ 依赖外部 API 可用性
- ⚠️ 需要处理 API 限流

### 3.2 增量同步策略

**适用数据**：历史成交、历史订单、资金费率历史

**原理**：
- 定时任务（每 5 分钟）拉取增量数据
- 使用 `skipDuplicates` 实现幂等
- 保留最近 90 天数据（可配置）

**实现步骤**：
1. 读取上次同步的最后时间戳（存储在 `DataPullJobState`）
2. 调用 API 获取增量数据（`startTime` = 上次时间戳）
3. 批量写入数据库（`createMany` + `skipDuplicates`）
4. 更新时间戳游标

---

## 四、后端接口设计

### 4.1 鲸鱼账户快照接口

**路由**：`GET /whale-tracking/traders/:address/snapshot`

**描述**：获取鲸鱼地址的实时账户快照（永续 + 现货）

**实现**：直接调用 Hyperliquid API，添加 5 秒缓存

**响应示例**：
```typescript
{
  // 永续合约数据
  perp: {
    accountValue: 792013.10,
    totalMarginUsed: 719000.00,
    totalPositionValue: 31034500.00,
    withdrawable: 73015.45,
    marginUsagePercent: 90.78,
    leverageRatio: 39.18,
    unrealizedPnl: -54885.83,
    roi: -7.63
  },

  // 现货数据
  spot: {
    totalValue: 12.20,
    balances: [
      {
        coin: "XAUT",
        total: 0.0027915,
        hold: 0,
        value: 12.09,
        sharePercent: 98.96
      },
      {
        coin: "USDC",
        total: 0.00560107,
        hold: 0,
        value: 0.01,
        sharePercent: 0.05
      }
    ]
  },

  // 合计
  total: {
    accountValue: 792025.30,
    perpPercent: 99.998,
    spotPercent: 0.002
  }
}
```

### 4.2 持仓详情接口

**路由**：`GET /whale-tracking/traders/:address/positions`

**描述**：获取用户当前持仓详情（支持永续/现货筛选）

**查询参数**：
- `type`：`perp` | `spot` | `all`（默认 `all`）

**响应示例**：
```typescript
{
  perp: [
    {
      coin: "BTC",
      side: "SHORT",
      size: -1899.07241,
      entryPrice: 88077.9,
      markPrice: 87429.0,
      liquidationPrice: 97656.0,
      positionValue: 166034001.73,
      marginUsed: 16603400.17,
      leverage: {
        type: "cross",
        value: 10
      },
      unrealizedPnl: 1232483.39,
      unrealizedPnlPercent: 7.42,
      fundingRate: 32146.82,
      roi: 7.42
    }
  ],
  spot: [
    {
      coin: "XAUT",
      total: 0.0027915,
      hold: 0,
      available: 0.0027915,
      value: 12.09
    }
  ]
}
```

### 4.3 挂单列表接口

**路由**：`GET /whale-tracking/traders/:address/open-orders`

**描述**：获取用户当前挂单列表

**查询参数**：
- `coin`（可选）：筛选币种

**响应示例**：
```typescript
[
  {
    orderId: 265007812594,
    coin: "ETH",
    side: "SELL",
    type: "limit",
    price: 4277.0,
    size: 22000.0,
    origSize: 22000.0,
    value: 94094000.00,
    timestamp: "2025-12-11T10:30:00.000Z",
    triggerPrice: null,
    triggerCondition: null,
    reduceOnly: false
  }
]
```

### 4.4 交易历史接口

**路由**：`GET /whale-tracking/traders/:address/trades`

**描述**：获取用户历史成交记录

**查询参数**：
- `coin`（可选）：筛选币种
- `startTime`（可选）：开始时间（毫秒）
- `endTime`（可选）：结束时间（毫秒）
- `limit`：返回数量（默认 100，最大 500）

**数据来源**：优先从数据库读取，若无数据则调用 API 并写入数据库

**响应示例**：
```typescript
[
  {
    coin: "HYPE",
    side: "BUY",
    price: 24.306,
    size: 123.3,
    value: 2997.13,
    startPosition: 230598.33,
    closedPnl: 0,
    fee: 0.36,
    time: "2025-12-19T08:15:00.000Z",
    hash: "0xabc123...",
    orderId: 123456789,
    crossed: true,
    liquidation: false
  }
]
```

### 4.5 历史订单接口

**路由**：`GET /whale-tracking/traders/:address/orders/history`

**描述**：获取用户历史订单列表

**查询参数**：
- `coin`（可选）：筛选币种
- `status`（可选）：`filled` | `canceled` | `rejected`
- `limit`：返回数量（默认 100，最大 500）

**数据来源**：从数据库读取

### 4.6 资金费率历史接口

**路由**：`GET /whale-tracking/traders/:address/funding-history`

**描述**：获取用户资金费率历史

**查询参数**：
- `coin`（可选）：筛选币种
- `startTime`：开始时间（毫秒）
- `endTime`：结束时间（毫秒）

**数据来源**：从数据库读取

### 4.7 PnL 趋势接口

**路由**：`GET /whale-tracking/traders/:address/pnl-trend`

**描述**：获取用户 PnL 时间序列数据

**查询参数**：
- `range`：`1d` | `1w` | `1m` | `all`
- `interval`：`1h` | `4h` | `1d`（时间粒度）

**实现方案**：
1. **短期方案**：基于历史成交数据逐笔累加 `closedPnl` 生成时间序列
2. **长期方案**：定时任务每小时快照账户状态，构建真实的账户价值曲线

**响应示例**：
```typescript
{
  range: "1w",
  interval: "1h",
  data: [
    {
      timestamp: "2025-12-13T00:00:00.000Z",
      accountValue: 750000.00,
      totalPnl: -250000.00,
      unrealizedPnl: -50000.00,
      realizedPnl: -200000.00
    },
    {
      timestamp: "2025-12-13T01:00:00.000Z",
      accountValue: 755000.00,
      totalPnl: -245000.00,
      unrealizedPnl: -45000.00,
      realizedPnl: -200000.00
    }
  ]
}
```

---

## 五、实现路径

### 阶段 1：基础设施搭建（1-2 天）

**目标**：建立 Hyperliquid API 客户端与数据同步任务框架

**任务清单**：
- [ ] 创建 `HyperliquidApiService` 服务类
  - 封装 HTTP 请求逻辑
  - 实现限流和重试机制
  - 添加响应缓存（5 秒 TTL）
- [ ] 创建 Prisma 模型（`HyperliquidUserFill`, `HyperliquidUserOrder`, `HyperliquidUserFunding`）
- [ ] 执行数据库迁移
- [ ] 添加环境变量：`HYPERLIQUID_API_URL`（默认 `https://api.hyperliquid.xyz`）

**验收标准**：
- 可成功调用 `clearinghouseState` 接口获取测试地址数据
- 数据库表创建成功

### 阶段 2：实时查询接口（2-3 天）

**目标**：实现账户快照、持仓详情、挂单列表接口

**任务清单**：
- [ ] 实现 `GET /whale-tracking/traders/:address/snapshot` 接口
- [ ] 实现 `GET /whale-tracking/traders/:address/positions` 接口
- [ ] 实现 `GET /whale-tracking/traders/:address/open-orders` 接口
- [ ] 添加 DTO 类型定义与 OpenAPI 文档
- [ ] 前端集成测试

**验收标准**：
- 接口返回正确的 Hyperliquid 数据
- 缓存机制生效（5 秒内重复请求命中缓存）
- 前端 Profile 页面显示实时账户数据

### 阶段 3：历史数据同步任务（3-4 天）

**目标**：实现增量同步历史成交、订单、资金费率

**任务清单**：
- [ ] 创建 `HyperliquidUserFillsJob` 同步任务
  - 定时拉取用户成交历史（针对已发现的鲸鱼地址）
  - 实现增量逻辑（基于上次同步时间戳）
- [ ] 创建 `HyperliquidHistoricalOrdersJob` 同步任务
- [ ] 创建 `HyperliquidUserFundingJob` 同步任务
- [ ] 添加任务调度配置（每 5 分钟执行一次）
- [ ] 实现数据清理逻辑（保留最近 90 天）

**验收标准**：
- 定时任务正常执行，无重复数据
- 数据库中存储了最近 90 天的历史数据
- 游标机制正常工作

### 阶段 4：历史数据查询接口（2-3 天）

**目标**：实现交易历史、订单历史、资金费率接口

**任务清单**：
- [ ] 实现 `GET /whale-tracking/traders/:address/trades` 接口
- [ ] 实现 `GET /whale-tracking/traders/:address/orders/history` 接口
- [ ] 实现 `GET /whale-tracking/traders/:address/funding-history` 接口
- [ ] 添加分页、筛选、排序功能
- [ ] 前端集成测试

**验收标准**：
- 接口正确返回数据库中的历史数据
- 分页和筛选功能正常工作
- 前端 Profile 页面 Tabs 显示完整历史数据

### 阶段 5：PnL 趋势接口（3-5 天）

**目标**：实现 PnL 时间序列数据接口

**任务清单**：
- [ ] 实现基于成交历史的 PnL 累加算法
  - 从 `HyperliquidUserFill` 表聚合 `closedPnl`
  - 按时间粒度分组（1h/4h/1d）
- [ ] 实现 `GET /whale-tracking/traders/:address/pnl-trend` 接口
- [ ] 添加结果缓存（10 分钟 TTL）
- [ ] 前端集成测试（PnLTrendCard 组件）

**可选增强**（长期方案）：
- [ ] 创建账户快照定时任务（每小时执行）
- [ ] 创建 `HyperliquidAccountSnapshot` 表
- [ ] 使用快照数据生成更精确的 PnL 曲线

**验收标准**：
- 接口返回正确的时间序列数据
- 前端图表正确渲染 PnL 趋势
- 多时间范围切换功能正常

### 阶段 6：性能优化与监控（2-3 天）

**目标**：优化 API 性能，添加监控告警

**任务清单**：
- [ ] 添加数据库索引优化
- [ ] 实现多级缓存策略（内存 + Redis）
- [ ] 添加 API 限流保护
- [ ] 集成 Prometheus 监控指标
  - Hyperliquid API 调用次数
  - API 响应时间
  - 缓存命中率
  - 同步任务执行状态
- [ ] 添加告警规则（API 失败率 > 5%）

**验收标准**：
- 接口响应时间 < 500ms（P95）
- 缓存命中率 > 80%
- 监控面板正常显示指标

---

## 六、风险与注意事项

### 6.1 API 限流风险

**Hyperliquid API 限流规则**：
- 基础限流：每秒最多 10 个请求
- 权重限流：某些端点有额外权重（如 `userFills` 每 20 条返回增加 1 权重）

**应对措施**：
- 实现请求队列和速率限制器
- 添加 5 秒短期缓存
- 异步批量处理历史数据同步

### 6.2 数据一致性问题

**场景**：Hyperliquid 数据更新后，缓存未及时刷新

**应对措施**：
- 账户快照类数据使用短期缓存（5 秒）
- 历史数据定期同步（5 分钟）
- 前端添加"刷新"按钮强制更新

### 6.3 成本控制

**存储成本**：
- 每个活跃鲸鱼地址每天约 500 条成交记录
- 100 个地址 * 90 天 * 500 条 ≈ 450 万条记录
- 预估存储空间：2-3 GB

**API 调用成本**：
- 按需查询：用户请求时实时调用（成本转嫁给用户体验）
- 增量同步：每 5 分钟同步 100 个地址 ≈ 每天 28,800 次 API 调用
- Hyperliquid API 免费，但需遵守限流规则

**优化建议**：
- 仅同步 Whale Alert 表中出现过的地址（动态地址池）
- 对不活跃地址降低同步频率（24 小时无交易 → 每小时同步一次）

### 6.4 数据质量监控

**需要监控的指标**：
- 同步任务成功率（应 > 95%）
- 数据缺失检测（时间戳断档）
- 异常值检测（突然的价格/数量异常）

**实现**：
- 每次同步记录日志和元数据
- 定期运行数据质量检查任务
- 发现异常时触发告警

---

## 七、参考资源

### 官方文档
- [Hyperliquid API - Info Endpoint](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint)
- [Hyperliquid API - Perpetuals](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/perpetuals)
- [Hyperliquid API - Spot](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/info-endpoint/spot)
- [Hyperliquid API - Rate Limits](https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/rate-limits-and-user-limits)

### 第三方文档
- [Chainstack - clearinghouseState](https://docs.chainstack.com/reference/hyperliquid-info-clearinghousestate)
- [Chainstack - userFills](https://docs.chainstack.com/reference/hyperliquid-info-user-fills)
- [Chainstack - openOrders](https://docs.chainstack.com/reference/hyperliquid-info-openorders)
- [Chainstack - spotClearinghouseState](https://docs.chainstack.com/reference/hyperliquid-info-spotclearinghousestate)

### SDK 参考
- [Official Python SDK](https://github.com/hyperliquid-dex/hyperliquid-python-sdk)
- [TypeScript SDK by nomeida](https://github.com/nomeida/hyperliquid)

---

## 八、总结

### 核心优势
✅ **数据完整性**：Hyperliquid API 提供所有前端所需的数据字段
✅ **实时性强**：账户快照按需查询，无延迟
✅ **成本可控**：免费 API，仅需管理限流
✅ **实现简单**：RESTful API，无需复杂集成

### 推荐方案
- **阶段 1-2**：优先实现实时查询接口，快速上线基础功能
- **阶段 3-4**：补充历史数据同步，完善数据维度
- **阶段 5**：实现 PnL 趋势，提升用户体验
- **阶段 6**：性能优化与监控，保障系统稳定性

### 预计工期
- **MVP 版本**（阶段 1-2）：3-5 天
- **完整版本**（阶段 1-5）：11-17 天
- **生产就绪**（阶段 1-6）：13-20 天
