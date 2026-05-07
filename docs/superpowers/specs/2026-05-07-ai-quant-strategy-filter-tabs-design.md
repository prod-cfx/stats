# AI Quant「我的策略」分类筛选 Tab 设计

- 日期：2026-05-07
- 范围：`apps/front` `account?tab=ai-quant` 页 `我的策略` 区块
- 触点文件：`apps/front/src/components/account/AiQuantStrategyList.tsx` 及对应 i18n / 测试

## 背景

`account?tab=ai-quant` 页面的 `我的策略` 列表当前一次性平铺所有策略（默认排除 `draft`），用户无法按状态快速聚焦。需要新增分类筛选，提升日常管理效率。

数据状态字段：
- `status`: `running` | `stopped` | `draft`
- `viewOnlyAt`: `string | null`，非空表示用户已主动把该策略转为只读历史快照（不能再 run / stop / delete）

后端 `GET /account/ai-quant/strategies` 已支持 `?status=running|stopped|draft`，但**不支持** `viewOnlyAt` 过滤参数。本次不改后端。

## 分类定义（互斥）

| Tab | 判定条件 | 含义 |
|---|---|---|
| 全部 | `viewOnlyAt == null`（叠加默认 `excludeDraft=true`） | 用户当前在管理的策略 |
| 运行中 | `status === 'running'` 且 `viewOnlyAt == null` | 正在跑的策略 |
| 已停止 | `status === 'stopped'` 且 `viewOnlyAt == null` | 已停止但仍可继续运行 / 删除 |
| 历史记录 | `viewOnlyAt != null` | 已封存的只读快照，仅供回看 |

计数关系：`全部 = 运行中 + 已停止`；`历史记录` 独立计数。

> 异常组合 `running + viewOnlyAt != null` 一律归入「历史记录」，与现有 `AiQuantStrategyList.tsx` 对 `isViewOnly` 的判定保持一致。

i18n key：

- `aiQuant.filter.all` / `Active`
- `aiQuant.filter.running` / `Running`
- `aiQuant.filter.stopped` / `Stopped`
- `aiQuant.filter.history` / `History`
- `aiQuant.filter.emptyForTab` / "当前分类下暂无策略" / "No strategies in this category"

中文 tab label：全部 / 运行中 / 已停止 / 历史记录。

## 数据获取

- `fetchAccountAiQuantStrategies` 调用一次，`limit` 由 `20` 改为 `200`
- 不带 `status` 参数（前端自由切 tab）
- 切 tab 不重新请求；列表数据源 `strategies` 保持现状

派生量（`useMemo`）：

```ts
const filteredStrategies = useMemo(
  () => filterByTab(strategies, activeTab),
  [strategies, activeTab],
)

const counts = useMemo(() => ({
  all: strategies.filter(s => !s.viewOnlyAt).length,
  running: strategies.filter(s => !s.viewOnlyAt && s.status === 'running').length,
  stopped: strategies.filter(s => !s.viewOnlyAt && s.status === 'stopped').length,
  history: strategies.filter(s => !!s.viewOnlyAt).length,
}), [strategies])
```

## UI 结构

在现有 `<h3>我的策略</h3>` 一行下方新增 tab 栏：

```
[ 我的策略 ]                          [总数徽章 = strategies.length]
─────────────────────────────────────────────────────────────────
[ 全部 12 ] [ 运行中 3 ] [ 已停止 5 ] [ 历史记录 4 ]
─────────────────────────────────────────────────────────────────
（列表渲染 filteredStrategies）
```

- 横向 tab 条；当前 tab 用主色下划线 + 加粗
- 每个 tab 后跟小号灰色数字徽章（沿用列表右上角总数样式）
- `useState<TabKey>('all')`，默认 `'all'`
- 切 tab 仅切派生数据，不发请求、不动滚动位置
- Tab 栏抽小组件 `<StrategyFilterTabs>`，同文件即可，不必新建文件

## 空态分支

```
strategies.length === 0
  ├─ isLoading → 沿用现有 loading 卡片
  ├─ error     → 沿用现有错误卡 + 重试
  └─ 否则       → 沿用现有大空态卡片（含「创建策略」CTA）

strategies.length > 0
  └─ 渲染 tab 栏 + 列表区
       ├─ filteredStrategies.length > 0 → 正常渲染列表
       └─ filteredStrategies.length === 0 → 一行小提示
            "当前分类下暂无策略" (aiQuant.filter.emptyForTab)
```

要点：

- 只有「完全没有任何策略」时才显示创建引导
- 其它 tab 为 0 时只是友好提示，用户能切回「全部」继续看

## 文件改动范围

- `apps/front/src/components/account/AiQuantStrategyList.tsx`
  - 引入 `TabKey` 类型 `'all' | 'running' | 'stopped' | 'history'`
  - 新增 `activeTab` state、`filteredStrategies` / `counts` memo
  - 抽 `<StrategyFilterTabs>` 子组件（同文件）
  - 调整 `loadStrategies` 中 `limit: 20 → 200`
  - 调整空态分支结构（如上）
- `apps/front/public/locales/zh/common.json`
- `apps/front/public/locales/en/common.json`
  - 新增 `aiQuant.filter.{all,running,stopped,history,emptyForTab}`
- 测试：`apps/front/src/components/account/ai-quant-strategy-list.test.ts`
  - 默认渲染 `tab=all`，徽章计数正确
  - 切到「运行中」只展示 `status=running` 且 `viewOnlyAt==null`
  - 切到「已停止」只展示 `status=stopped` 且 `viewOnlyAt==null`，**排除** view-only 的 stopped
  - 切到「历史记录」只展示 `viewOnlyAt!=null`
  - `running + viewOnlyAt!=null` 异常组合归入「历史记录」
  - tab 下 0 条时渲染 `emptyForTab` 文案，不渲染大空态卡片
  - `strategies.length===0` 时仍走原大空态卡片（含创建 CTA）

## 不在本次范围

- 不改后端、不加 view-only 后端过滤参数
- 不加分页 UI；`limit=200` 对个人策略列表足够（超过则后续单独处理）
- 不改 `excludeDraft` 默认行为
- 不动 admin 端
- 不改 `AiQuantStrategyDetail` 页面

## 风险与回滚

- 风险：极端用户（>200 条策略）会被截断。当前业务里属于异常长尾，先以一行注释说明；后续若出现真实诉求再上分页。
- 回滚：纯前端改动，单文件回退即可恢复。
