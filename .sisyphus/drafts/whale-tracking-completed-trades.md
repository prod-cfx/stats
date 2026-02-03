# Draft: Whale Tracking 已完成交易 Tab 接入 Hyperliquid

## Requirements (confirmed)
- 前端页面 `whale-tracking/profile` 底部 Tab「已完成交易」目前数据为空。
- 需要在前端直接接入 Hyperliquid 官方 API，不经过自家后端服务器。
- 参考页面：https://hyperbot.network/trader/0xE867fbDAD3291530E41530301EcB77693850C78e 底部「已完成交易」的交互（点击加载，懒加载更多数据）。
 - 展示字段：完全对标 hyperbot 页面上的「已完成交易」列表字段，不做裁剪。
 - 分页策略：点击“加载更多”，每次固定加载一页（具体条数与 Hyperliquid/hyperbot 默认保持一致），直到无更多数据。
 - 时间范围与市场范围：参考 hyperbot 的实现逻辑（时间窗口、市场类型等保持一致，不做自定义规则）。
 - 排序：按成交时间倒序（最新成交在前）。
 - 过滤：当前不需要任何过滤项（不支持前端筛选操作）。
 - 验收方式：以手动验证为主（在页面中操作并确认数据展示与 hyperbot 一致）。

## Technical Decisions
- 待定：使用何种数据获取方式（Next.js 前端 fetch/SWR/React Query 等），需结合现有 front 的数据获取规范实现。
- 已定：完全对标 hyperbot 的字段与排序，暂不提供过滤功能。
- 已定：本次以手动验证为主，不强制新增自动化测试。

## Research Findings
- Hyperliquid 官方已提供 `userFills` info 接口用于查询指定地址的成交记录：
  - Endpoint：`POST https://api.hyperliquid.xyz/info`
  - Request Body（JSON）：
    - `type: "userFills"`（必填，固定字符串）
    - `user: string`（必填，42 字节 0x 开头地址，例如 `0x0000...`）
    - `aggregateByTime?: boolean`（可选，true 时会按时间聚合部分成交）
  - 返回：最近成交的数组，最多 2000 条，按时间倒序（最新在前）。
  - 每条 fill 的核心字段：
    - `coin`：资产标识（永续直接是 "BTC"/"ETH" 等，现货是 "@107" 这类索引型字符串）；
    - `px`：成交价（字符串，保留精度）；
    - `sz`：成交量（字符串）；
    - `side`："A"=卖/Ask，"B"=买/Bid；
    - `time`：毫秒级时间戳；
    - `tid`：成交 ID；
    - `oid`：订单 ID；
    - `dir`：方向说明（如 "Open Long"/"Close Short"/"Buy"/"Sell"）；
    - `closedPnl`：本次成交带来的已实现盈亏；
    - `fee` / `feeToken`：手续费及其币种（一般 USDC）；
    - `hash`：链上交易哈希；
    - 可选 `builderFee` 等额外字段。
  - 限制：单次最多返回 2000 条、仅能拿到最近 ~10000 条左右成交；如需“加载更多”可以前端本地分页（一次拉 2000 条，点击加载更多只是前端 slice），也可以后续评估是否需要基于 `userFillsByTime` 等时间窗口接口做真正后端分页。

## Open Questions
- 需要展示的字段与 UI 是否完全对标 hyperbot，还是可以做裁剪？
- 分页/加载更多的交互是否有上限（比如最多加载 N 页）？
- 是否需要本地缓存、刷新按钮等附加能力？
- 是否需要为该功能补充自动化测试（前端单测/端到端），还是只做手动验收？
- 是否有需要兼容的移动端/小屏展示规范？

## Scope Boundaries
- INCLUDE: 实现「已完成交易」Tab 的数据获取与渲染逻辑，前端直接调用 Hyperliquid 官方 API，实现点击加载更多的交互。
- EXCLUDE: 后端服务改动、数据库 schema 改动、自家 API 的新增/修改（除非后续明确要求）。

## Test Strategy Decision
- **Infrastructure exists**: 是（front 已存在 Jest 测试文件，可按需复用）。
- **User wants tests**: 暂不强制新增测试。
- **QA approach**: 仅手动验收，重点对比 hyperbot 的显示效果与数据正确性。
