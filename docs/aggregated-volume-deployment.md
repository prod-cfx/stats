# 聚合交易量功能部署指南

## 功能概述

聚合交易量功能从 Coinglass API 拉取各交易所的 24h 成交量数据，并提供前端实时展示。

**支持币种**: BTC、ETH、SOL、XRP、DOGE、HYPE、BNB
**支持合约类型**: SPOT（现货）、PERPETUAL（永续合约）
**数据来源**: Coinglass API
**更新频率**: 后端 60 秒同步，前端 3 秒轮询

---

## 架构设计

```
┌─────────────────┐     60s      ┌──────────────────┐
│ Coinglass API   │ ←────────── │ Data Sync Job    │
└─────────────────┘              │ (Backend)        │
                                 └──────────────────┘
                                         │
                                         ↓
                                ┌──────────────────┐
                                │ PostgreSQL       │
                                │ aggregated_      │
                                │ volumes 表       │
                                └──────────────────┘
                                         │
                                         ↓
                                ┌──────────────────┐     3s poll
                                │ REST API         │ ←──────────
                                │ /markets/volume/ │
                                │ aggregated       │
                                └──────────────────┘
                                         ↓
                                ┌──────────────────┐
                                │ Frontend         │
                                │ (React)          │
                                └──────────────────┘
```

---

## 前置要求

1. **PostgreSQL 数据库** (已安装并运行)
2. **Node.js >= 20.19.0**
3. **pnpm >= 10.22.0**
4. **Coinglass API Key** (环境变量配置)

---

## 部署步骤

### 1. 数据库迁移

#### 方式 1: 使用 psql 客户端（推荐）

```bash
# 切换到项目目录
cd /Users/sa/Documents/codes/coinflux/stats_issue_agg_vol

# 执行迁移脚本
psql -U your_username -d coinflux -f apps/backend/prisma/migrations/manual_add_aggregated_volume.sql

# 验证表已创建
psql -U your_username -d coinflux -c "\d aggregated_volumes"
```

#### 方式 2: 使用 Prisma CLI

```bash
cd apps/backend
npx prisma migrate dev --name add-aggregated-volume
```

#### 迁移脚本说明

**创建的表**: `aggregated_volumes`

| 字段            | 类型           | 说明                              |
| --------------- | -------------- | --------------------------------- |
| id              | SERIAL         | 主键                              |
| exchange        | TEXT           | 交易所名称（'All' 表示聚合总量）  |
| symbol          | TEXT           | 币种符号（如 'BTC'）              |
| instrument_type | TEXT           | 合约类型（'SPOT' 或 'PERPETUAL'） |
| volume_usd      | DECIMAL(30,10) | 24h 成交量（USD）                 |
| data_timestamp  | TIMESTAMP      | 数据时间戳                        |
| source          | TEXT           | 数据来源（默认 'COINGLASS'）      |
| created_at      | TIMESTAMP      | 创建时间                          |
| updated_at      | TIMESTAMP      | 更新时间                          |

**创建的索引**:

- 唯一索引: `(exchange, symbol, instrument_type, data_timestamp)`
- 查询索引: `(symbol, instrument_type, data_timestamp)`
- 查询索引: `(exchange, instrument_type, data_timestamp)`
- 查询索引: `(data_timestamp)`

### 2. 配置数据同步任务

```bash
# 执行任务配置脚本
psql -U your_username -d coinflux -f apps/backend/prisma/migrations/manual_add_volume_sync_tasks.sql

# 验证任务已创建
psql -U your_username -d coinflux -c "SELECT key, enabled, interval_seconds FROM data_pull_tasks WHERE key LIKE 'markets-volume-sync-%';"
```

**创建的任务** (7 个):

| 任务 Key                 | 币种 | 间隔 | 状态 |
| ------------------------ | ---- | ---- | ---- |
| markets-volume-sync-BTC  | BTC  | 60s  | 启用 |
| markets-volume-sync-ETH  | ETH  | 60s  | 启用 |
| markets-volume-sync-SOL  | SOL  | 60s  | 启用 |
| markets-volume-sync-XRP  | XRP  | 60s  | 启用 |
| markets-volume-sync-DOGE | DOGE | 60s  | 启用 |
| markets-volume-sync-HYPE | HYPE | 60s  | 启用 |
| markets-volume-sync-BNB  | BNB  | 60s  | 启用 |

### 3. 配置环境变量

确保 `.env.development.local` 中包含 Coinglass API Key:

```bash
# apps/backend/.env.development.local 或项目根目录 .env.development.local
COINGLASS_API_KEY=your_api_key_here

# 可选：自定义 API 端点
COINGLASS_OI_ENDPOINT=https://open-api-v4.coinglass.com/api/futures/open-interest/exchange-list
```

### 4. 生成 Prisma Client

```bash
cd /Users/sa/Documents/codes/coinflux/stats_issue_agg_vol
cd apps/backend
npx prisma generate
```

### 5. 生成 API SDK

```bash
cd /Users/sa/Documents/codes/coinflux/stats_issue_agg_vol
dx build contracts --dev
```

**生成的文件**: `packages/api-contracts/src/generated/backend.ts`

包含新增的类型和 API 方法：

- `GetAggregatedVolumeRequestDto`
- `AggregatedVolumeResponseDto`
- `GET /markets/volume/aggregated`

### 6. 启动服务

#### 启动后端

```bash
cd /Users/sa/Documents/codes/coinflux/stats_issue_agg_vol
dx start backend --dev
```

**验证后端启动成功**:

- 服务监听: `http://localhost:3000`
- 健康检查: `curl http://localhost:3000/health`
- Swagger 文档: `http://localhost:3000/api/docs`

#### 启动前端

```bash
# 在另一个终端
cd /Users/sa/Documents/codes/coinflux/stats_issue_agg_vol
dx start front --dev
```

**验证前端启动成功**:

- 服务监听: `http://localhost:3001`
- 访问页面: `http://localhost:3001/aggregated-orderbook`

---

## 验证功能

### 自动验证脚本

```bash
cd /Users/sa/Documents/codes/coinflux/stats_issue_agg_vol
dx start all
```

脚本会自动检查：

1. 数据库连接
2. 数据库表结构
3. 数据同步任务配置
4. API 端点可用性
5. 前端集成状态

### 手动验证步骤

#### 1. 验证数据库表

```sql
-- 查看表结构
\d aggregated_volumes

-- 查看数据
SELECT exchange, symbol, instrument_type, volume_usd, data_timestamp
FROM aggregated_volumes
WHERE symbol = 'BTC' AND instrument_type = 'PERPETUAL'
ORDER BY data_timestamp DESC
LIMIT 10;

-- 验证 'All' 聚合记录
SELECT * FROM aggregated_volumes WHERE exchange = 'All';
```

**预期结果**:

- 表包含 9 个字段
- 有 4 个索引（1 个唯一索引 + 3 个查询索引）
- 数据正常更新（`data_timestamp` 接近当前时间）

#### 2. 验证 API 端点

```bash
# 测试 BTC 聚合交易量
curl -X GET "http://localhost:3000/markets/volume/aggregated?symbol=BTC&instrumentType=PERPETUAL&page=1&limit=20" | jq

# 测试 ETH 聚合交易量
curl -X GET "http://localhost:3000/markets/volume/aggregated?symbol=ETH&instrumentType=PERPETUAL&page=1&limit=20" | jq
```

**预期响应**:

```json
{
  "total": 12,
  "page": 1,
  "limit": 20,
  "items": [
    {
      "id": 1,
      "exchange": "All",
      "symbol": "BTC",
      "instrumentType": "PERPETUAL",
      "volumeUsd": "44590000000.0000000000",
      "dataTimestamp": "2024-01-14T06:00:00.000Z",
      "source": "COINGLASS",
      "createdAt": "2024-01-14T06:00:10.000Z",
      "updatedAt": "2024-01-14T06:00:10.000Z"
    },
    {
      "id": 2,
      "exchange": "Binance",
      "symbol": "BTC",
      "instrumentType": "PERPETUAL",
      "volumeUsd": "12856300000.0000000000",
      "dataTimestamp": "2024-01-14T06:00:00.000Z",
      "source": "COINGLASS",
      "createdAt": "2024-01-14T06:00:10.000Z",
      "updatedAt": "2024-01-14T06:00:10.000Z"
    }
    // ...更多交易所
  ]
}
```

**关键验证点**:

- `exchange='All'` 排在第一位
- `volumeUsd` 为 Decimal 转 string（非科学计数法）
- `items` 按 `volumeUsd` 降序排列（除 'All' 外）

#### 3. 验证前端页面

1. 访问 `http://localhost:3001/aggregated-orderbook`
2. 切换到第三个 tab（聚合成交量）
3. 验证以下功能：
   - ✓ 显示真实数据（不再是固定的 mock 数据）
   - ✓ 'TOTAL' 行显示聚合总量
   - ✓ 交易所按成交量降序排列
   - ✓ 数据每 3 秒自动刷新
   - ✓ 可以切换币种（BTC/ETH/SOL/XRP/DOGE/HYPE/BNB）
   - ✓ 鼠标悬停显示详细信息

#### 4. 验证数据同步

```bash
# 查看最近的数据同步执行记录
psql -U your_username -d coinflux -c "
SELECT t.key, e.status, e.started_at, e.completed_at, e.error_message
FROM data_pull_executions e
JOIN data_pull_tasks t ON e.task_id = t.id
WHERE t.key LIKE 'markets-volume-sync-%'
ORDER BY e.started_at DESC
LIMIT 10;
"
```

**预期结果**:

- 每个任务每 60 秒执行一次
- `status = 'SUCCESS'`
- `error_message` 为空

---

## 常见问题排查

### 问题 1: 数据库连接超时

**症状**: Prisma migrate 或 generate 报错 `P1002: The database server was reached but timed out`

**解决方案**:

```bash
# 检查 PostgreSQL 是否运行
pg_isready

# 如果未运行，启动数据库
brew services start postgresql@14
# 或
pg_ctl -D /usr/local/var/postgres start

# 检查数据库连接配置
cat .env.development.local | grep DATABASE_URL
```

### 问题 2: API 返回 404

**症状**: `curl http://localhost:3000/markets/volume/aggregated` 返回 404

**排查步骤**:

1. 确认后端服务已启动
2. 检查 Controller 是否正确注册
3. 验证 SDK 是否已生成
4. 查看后端日志是否有错误

```bash
# 检查路由是否注册
curl http://localhost:3000/api/docs | grep "volume/aggregated"
```

### 问题 3: 前端显示 mock 数据

**症状**: 前端仍显示固定的 mock 数据，不会更新

**排查步骤**:

1. 检查浏览器 Network 面板，是否有 API 请求
2. 检查 API 请求是否返回 200
3. 检查前端组件是否使用了正确的 API 调用
4. 清除浏览器缓存并刷新页面

```bash
# 检查前端代码
grep -n "client.GET.*markets/volume/aggregated" apps/front/src/components/aggregated-orderbook/AggregatedVolume.tsx
```

### 问题 4: 数据未同步

**症状**: `aggregated_volumes` 表为空或数据不更新

**排查步骤**:

1. 检查数据同步任务是否启用
2. 检查 Coinglass API Key 是否配置
3. 查看后端日志是否有错误
4. 手动触发数据同步测试

```sql
-- 检查任务状态
SELECT key, enabled, last_run_at FROM data_pull_tasks WHERE key LIKE 'markets-volume-sync-%';

-- 检查执行记录
SELECT * FROM data_pull_executions WHERE task_id IN (
  SELECT id FROM data_pull_tasks WHERE key LIKE 'markets-volume-sync-%'
)
ORDER BY started_at DESC LIMIT 5;
```

### 问题 5: TypeScript 类型错误

**症状**: 前端编译时报 API 类型错误

**解决方案**:

```bash
# 重新生成 SDK
dx build contracts --dev

# 重启前端开发服务器
dx start front --dev
```

---

## 监控和维护

### 数据质量监控

```sql
-- 检查数据完整性（每个币种应有 12+ 条记录）
SELECT symbol, instrument_type, COUNT(*) as record_count, MAX(data_timestamp) as latest_sync
FROM aggregated_volumes
GROUP BY symbol, instrument_type
ORDER BY symbol, instrument_type;

-- 检查 'All' 聚合记录是否正确
SELECT symbol, instrument_type,
       (SELECT SUM(volume_usd) FROM aggregated_volumes av2
        WHERE av2.symbol = av.symbol
          AND av2.instrument_type = av.instrument_type
          AND av2.data_timestamp = av.data_timestamp
          AND av2.exchange != 'All') as calculated_total,
       av.volume_usd as stored_total
FROM aggregated_volumes av
WHERE exchange = 'All'
ORDER BY data_timestamp DESC
LIMIT 5;
```

### 性能监控

```sql
-- 查看索引使用情况
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'aggregated_volumes'
ORDER BY idx_scan DESC;

-- 查看表大小
SELECT pg_size_pretty(pg_total_relation_size('aggregated_volumes')) as total_size,
       pg_size_pretty(pg_relation_size('aggregated_volumes')) as table_size,
       pg_size_pretty(pg_indexes_size('aggregated_volumes')) as indexes_size;
```

### 数据清理（可选）

由于只保留最新快照，旧数据可定期清理：

```sql
-- 保留最近 24 小时的数据
DELETE FROM aggregated_volumes
WHERE data_timestamp < NOW() - INTERVAL '24 hours';

-- 或使用定时任务
-- 参考: apps/backend/src/modules/markets/jobs/cleanup-old-trades.job.ts
```

---

## 回滚方案

如需回滚功能：

### 1. 停止数据同步任务

```sql
UPDATE data_pull_tasks
SET enabled = false
WHERE key LIKE 'markets-volume-sync-%';
```

### 2. 删除数据库表（可选）

```sql
DROP TABLE IF EXISTS aggregated_volumes CASCADE;
```

### 3. 恢复前端 mock 数据

```bash
git checkout HEAD -- apps/front/src/components/aggregated-orderbook/AggregatedVolume.tsx
```

---

## 扩展功能建议

### 1. 添加更多币种

编辑任务配置脚本，添加新的数据同步任务：

```sql
INSERT INTO data_pull_tasks (key, name, enabled, interval_seconds, meta, created_at, updated_at)
VALUES ('markets-volume-sync-NEW_SYMBOL', 'NEW_SYMBOL 聚合交易量同步', true, 60, '{"symbol":"NEW_SYMBOL","instrumentType":"PERPETUAL"}', NOW(), NOW());
```

### 2. 支持现货数据

修改任务配置，将 `instrumentType` 设为 `'SPOT'`：

```sql
INSERT INTO data_pull_tasks (key, name, enabled, interval_seconds, meta, created_at, updated_at)
VALUES ('markets-volume-sync-BTC-SPOT', 'BTC 现货聚合交易量同步', true, 60, '{"symbol":"BTC","instrumentType":"SPOT"}', NOW(), NOW());
```

### 3. 历史数据存储

如需保留历史数据用于趋势分析，修改清理策略或创建归档表。

### 4. 数据导出 API

添加导出接口，支持 CSV/Excel 格式下载：

```typescript
// apps/backend/src/modules/markets/markets.controller.ts
@Get('volume/aggregated/export')
async exportAggregatedVolumes(@Query() query: ExportVolumeRequestDto) {
  // 实现导出逻辑
}
```

---

## 技术支持

遇到问题时，请提供以下信息：

1. 错误日志（后端控制台输出）
2. API 响应（使用 curl 测试）
3. 数据库查询结果（使用上述 SQL）
4. 浏览器控制台错误（前端问题）
5. 环境信息（Node 版本、PostgreSQL 版本）

---

## 更新历史

- **2026-01-14**: 初始版本，支持 7 个币种的聚合交易量数据同步和展示
