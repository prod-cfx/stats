## 2026-02-03 - Whale tracking profile tabs (front)

- `apps/front/src/app/[lng]/whale-tracking/profile/page.tsx` is a client wrapper rendering `WhaleProfileClientPage` inside `Suspense`.
- `apps/front/src/app/[lng]/whale-tracking/profile/ProfileClient.tsx` fetches ALL profile data once on mount via `fetchTraderFullData(address)` and stores `snapshot/positions/orders/portfolio/fills` in local state. No tab-dependent fetch.
- `apps/front/src/components/whale-tracking/profile/ProfileDataTabs.tsx` is `use client` and owns `activeTab` state. It only receives `spotPositions`, `perpPositions`, `openOrders` props.
- In `ProfileDataTabs`, the tabs `trades/history/delegation` are explicit placeholders: `filteredRecentTrades`, `filteredCompletedTrades`, `filteredHistoryOrders` are `useMemo(() => [], [])`. Clicking a tab only calls `setActiveTab(...)` and resets sort state, so no network request can happen.

Concrete integration points to trigger requests / data flow:

1. Prefetch in `ProfileClient` (already has address) and pass down
   - Add new state (e.g. `completedTrades`) in `ProfileClient`, populate it from `fullData.fills` (or a dedicated endpoint), then pass as props to `ProfileDataTabs`.
2. Lazy-load on tab activation in `ProfileDataTabs`
   - Pass `address` (or a fetch callback) into `ProfileDataTabs`.
   - Add a `useEffect` watching `activeTab`; when it becomes `history` (completed trades) call a fetch function and store results in component state.
3. Direct onClick hook
   - In the tab button `onClick`, detect `tab.id === 'history'` and trigger fetch (requires `address` or callback prop).

## 2026-02-03 - 已完成交易 (Completed Trades) 集成

### 实现方案：使用现有 fills 数据

- `fetchTraderFullData(address)` 已包含 `UserFillsResponse`（fills 数组）
- 无需新增 API 端点，直接复用现有数据源

### 代码变更

#### 1. ProfileClient.tsx

- 将 `fillsData` 传递给 `ProfileDataTabs` 组件（line 104）

#### 2. ProfileDataTabs.tsx

- **新增 props**: `fillsData: UserFillsResponse | null`
- **数据转换**: `convertFillsToCompletedTrades()` 将 `UserFill[]` 转换为 `CompletedTrade[]`
  - `UserFill` 字段：`coin`, `price`, `size`, `side`, `time`, `direction`, `closedPnl`, `fee`, `hash`
  - `CompletedTrade` 字段：`endTime`, `asset`, `side`, `duration`, `netPnl`, `size`, `exitPrice`, `fee`
- **排序**: `sortedCompletedTrades` 按 `endTime` 降序（最新交易在前）
- **本地分页**:
  - 状态：`historyPage`, `HISTORY_PAGE_SIZE = 50`
  - `paginatedCompletedTrades`: 根据 `historyPage` 切片显示
  - "加载更多"按钮：当 `(page + 1) * pageSize < total` 时显示
- **空状态**:
  - 当 `paginatedCompletedTrades.length === 0` 时显示
  - 区分完全无数据 vs 过滤后无结果

### 技术细节

- **持时计算限制**: 由于 `fills` 是独立成交记录而非完整持仓周期，无法准确计算完整持仓时间。当前使用占位值（随机小时+分钟），后续需要后端支持完整持仓数据或前端追踪开仓/平仓配对
- **React 数组渲染**: 使用数组展开 `[...map(), emptyState, loadMore]` 在条件表达式中渲染多个元素
- **类型安全**: 所有变量使用 TypeScript 类型，避免隐式 any

### 国际化键值

需要新增的翻译键：

- `whaleTracking.profile.empty.completedTrades` - 无完成交易提示
- `whaleTracking.profile.empty.filteredResults` - 过滤后无结果提示
- `whaleTracking.profile.loadMore` - 加载更多按钮

## 2026-02-03 - 已完成交易显示逻辑修正

### 问题与解决方案

1. **time 格式问题**
   - 问题：使用 `toLocaleDateString('zh-CN')` 只显示日期
   - 解决：改用 `toLocaleString('zh-CN')` 并替换斜杠为短横线，显示 `YYYY-MM-DD HH:mm:ss`

2. **排序问题**
   - 问题：将 time 转换为字符串后再解析排序，低效且容易出错
   - 解决：在 `CompletedTrade` 接口新增 `fillTime: number` 字段，转换时保留原始值，排序直接使用数值

3. **duration 随机问题**
   - 问题：使用 `Math.random()` 生成占位值
   - 解决：改为显示 `-`，表示无法计算

4. **fee 显示问题**
   - 问题：只显示数值，没有单位
   - 解决：由于 `UserFill` 接口没有 `feeToken` 字段，继续只显示数值（`toFixed(4)`）

5. **分页初始值**
   - 问题：`historyPage = 0` 是正确的（第一页索引为 0）
   - 解决：保持不变，`paginatedCompletedTrades` 使用 `page * pageSize` 切片计算正确

### 代码变更

- `CompletedTrade` 接口新增 `fillTime: number` 字段
- `convertFillsToCompletedTrades()` 修改：
  - time 格式改为 `toLocaleString('zh-CN')` + `.replace(/\//g, '-')`
  - duration 固定为 `'-'`
  - fee 简化为 `fill.fee.toFixed(4)`
  - return 对象添加 `fillTime: fill.time`
- `sortedCompletedTrades` 改为使用 `fillTime` 数值排序

### 注意事项

- LSP 报告的 `ArrowUpDown` 等组件类型错误是项目已有问题，不影响构建
- 当前 `UserFill` 接口缺少 `feeToken` 字段，如需要显示币种需扩展接口（涉及后端 DTO 转换）

## 2026-02-03 - 已完成交易分页模式修正（追加模式）

### 问题

- 点击"加载更多"后仍只显示 50 条，数据被替换而非追加
- 用户期望行为：点击后显示 50 → 100 → 150 条，保留之前的数据

### 根本原因

原分页逻辑使用翻页替换模式：

```typescript
const paginatedCompletedTrades = useMemo(() => {
  const startIndex = historyPage * HISTORY_PAGE_SIZE
  const endIndex = startIndex + HISTORY_PAGE_SIZE
  return sortedCompletedTrades.slice(startIndex, endIndex)
}, [sortedCompletedTrades, historyPage])
```

- `historyPage = 0`: `slice(0, 50)` → 前 50 条
- `historyPage = 1`: `slice(50, 100)` → 第 51-100 条（替换前 50 条）
- `historyPage = 2`: `slice(100, 150)` → 第 101-150 条（替换）

### 解决方案

改为追加模式，始终从索引 0 开始切片：

```typescript
const paginatedCompletedTrades = useMemo(() => {
  const endIndex = (historyPage + 1) * HISTORY_PAGE_SIZE
  return sortedCompletedTrades.slice(0, endIndex)
}, [sortedCompletedTrades, historyPage])
```

- `historyPage = 0`: `slice(0, 50)` → 前 50 条
- `historyPage = 1`: `slice(0, 100)` → 前 100 条（追加）
- `historyPage = 2`: `slice(0, 150)` → 前 150 条（追加）

### 代码变更

- `ProfileDataTabs.tsx` 第 606-610 行：修改分页 slice 逻辑
- 添加注释说明追加模式行为（第 606 行）
- 按钮文案添加中文 fallback：`t('whaleTracking.profile.loadMore', '加载更多')`

### 验证

- `dx build front --dev` 通过
- 无更多数据时按钮自动隐藏（条件：`(page + 1) * pageSize < total`）
- 排序保持 `fill.time` 降序不变

## 2026-02-03 - Hyperliquid userFills 合约与 QA 证据

- Endpoint: `POST https://api.hyperliquid.xyz/info`
- Request body (示例): `{ "type": "userFills", "user": "0xE867...", "aggregateByTime": false }`
- Response: fills 数组（最多 2000），包含 `coin/px/sz/side/time/dir/closedPnl/fee/feeToken/hash/...` 等字段
- 本项目实现：页面加载时在 `ProfileClient` 调用 `fetchTraderFullData(address)`，其中包含 userFills；history tab 仅负责展示和本地“加载更多”追加显示（50 -> 100 -> 150）。
- Playwright 验证（2026-02-03）：
  - history 首屏显示 50 行；点击一次“加载更多”后显示 100 行（追加，不替换）
  - Network 捕获到 `POST https://api.hyperliquid.xyz/info` 200，body 含 `type:userFills` + 对应地址

## 2026-02-03 - 语义对齐：completed trades = close fills

- 决策：Profile 的 `已完成交易` 等同于 Hyperliquid `userFills` 中 `dir` 以 `Close` 开头的成交（`Close Long`/`Close Short`），不展示 `Open*`。
- 原因：Open fills 往往 `closedPnl=0` 且无法代表“已完成”，会导致 UI 大量 `+0.00` 与 duration `-`，与 hyperbot 的 completed trades 语义不一致。
- 落地：前端表格过滤 Close\*；fee 显示 `fee.toFixed(4)` + 空格 + `feeToken`；duration 在存在同 `coin+side` 的最近一次 Open 时用 `closeTime - openTime` 计算，否则 `-`。
