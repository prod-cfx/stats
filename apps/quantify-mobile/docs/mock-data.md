# Mock 数据规格

本文档记录 `quantify-mobile` 在 `USE_MOCK` 模式下各 Repository 的数据形状、刷新策略与
真实 API 接入后的对齐要点。

## 启动开关

- 编译期常量：`String.fromEnvironment('USE_MOCK', defaultValue: 'true')`
- 解析策略：**严格只认 `false`（不区分大小写）**；缺省值或任何其它字符串一律视为 mock
- 关闭 mock：`flutter run --dart-define=USE_MOCK=false`
- 关闭 mock 后，未在 PR2 接入真实 API 的 10 个 Repository 调用方法会抛 Dart 内置
  `UnimplementedError`，消息固定格式：`真实 API 待接入: <RepositoryName>`

## 当前进度

PR1 已落 11 个 Repository 接口、Unimplemented stub 与 `AuthRepository` 示例 Mock。
PR2 已补齐其余 10 个 `MockXxxRepository`、对应 fixtures 与两条 Stream
（K 线 1s / 巨鲸 3s）。`useMock=true` 时全部走 Mock 实现；`useMock=false` 时调用
方法仍抛 `UnimplementedError`，保留作为真实 API 接入前的占位语义。

通用模式：
- `Future` 方法：固定 `Future.delayed(Duration(milliseconds: 200))` 模拟网络延迟
- `Stream` 方法：优先使用 `Stream<T>.periodic(...)`；订阅取消时底层 `Timer` 自动释放
- 需要确定性的位置（K 线漂移、巨鲸抽样）统一使用 `Random(42)` 种子

## Repository 列表

### AuthRepository

- **形状**：`AuthSession { userId, token, email }`
- **策略**：
  - `login`：任意 `email` / `password` 200ms 延迟后返回固定
    `AuthSession(userId: 'mock-user', token: 'mock-token', email: <输入>)`
  - `logout`：清空内存 session
  - `watchSession`：通过 `StreamController.broadcast()` 推送；订阅时先 `yield` 当前 session
- **真实 API 对齐**：接入后 `userId` / `token` 来自后端响应；保持 `Stream<AuthSession?>`
  在登入/登出时序的等价行为

### Stream 语义约定

> Mock 阶段全局规范，避免后续 10 个 Repository 重复写脆弱的 `async*` 拼装。

- **订阅即推当前值**：`watchSession` 等返回 `Stream` 的方法，订阅时应先发送当前内部状态，
  再接转 `StreamController.broadcast()`。当前 `MockAuthRepository.watchSession()` 用
  `yield _session; yield* _controller.stream;` 实现，`yield` 与 `yield*` 之间存在极小事件窗口
  （测试以 `Future.delayed(Duration.zero)` 让出 microtask 规避）。PR2 会引入统一 helper
  （形如 `seededBroadcast(initial, controller)`）消除该模式重复
- **Unimplemented 阶段的 Stream 错误传播**：`Unimplemented*Repository` 在 Stream-returning
  方法上**同步抛** `UnimplementedError`（不是返回 `Stream.error(...)` 异步派发）。这是占位
  阶段的简化语义；PR2 接入真实 API 后，Stream 错误应改走 `controller.addError(...)` 异步派发
  以符合常规 Dart Stream 错误模型

### TickerRepository

- **形状**：`Ticker { symbol, price, changePercent, volume24h }`
- **策略**：
  - `listTickers`：返回 `fixtures/tickers.dart` 中的 8 条静态行情
  - `watchTicker(symbol)`：`Stream.periodic(1s)` 推送基于 `Random(42)` 的微小价格漂移
  - **未知 symbol 回退**：`watchTicker` 在 mock 中未匹配 `mockTickers` 时回退第一条
- **真实 API 对齐**：接入后改走 `GET /markets/tickers` + WebSocket ticker 通道

### KlineRepository

- **形状**：`Candle { openTime, open, high, low, close, volume }` + `KlineInterval`
- **策略**：
  - `listCandles`：`generateSeededCandles(...)` 从 `kCandleBaselinePrice` 起点用
    `Random(42)` 走 `count` 步随机游走（每根 ±0.6%，spread ±0.3%）
  - `watchCandles`：`Stream.periodic(1s)` 调用 `nextSeededCandle(last, ...)` 推
    下一根；`openTime` 按 `interval` 步长严格递增
  - **mock 阶段 `symbol` 被忽略**：watchCandles 起点为 `baseline` 单根序列的末尾，
    不接续 `listCandles` 的最后一根；这是 mock 简化，真实 API 接入后两者必须连续
- **Stream 节奏**：`Stream.periodic(Duration(seconds: 1))`
- **真实 API 对齐**：接入后 `listCandles` 走 REST 历史 K 线接口；
  `watchCandles` 切换到行情 WebSocket 的 K 线通道

### OrderbookRepository

- **形状**：`OrderbookSnapshot { symbol, bids[], asks[], timestamp }`
- **策略**：
  - `getSnapshot(symbol)`：以 `mockTickers` 对应 ticker 的 price 作 mid，
    `buildMockOrderbook(...)` 生成 10 档对称买卖盘
  - `watchOrderbook(symbol)`：`Stream.periodic(1s)` 每秒推送一份新时间戳的快照
  - **未知 symbol 回退**：`getSnapshot/watchOrderbook` 在 `mockTickers` 未命中时回退第一条
- **真实 API 对齐**：接入后切换到聚合盘口 WebSocket

### LongShortRepository

- **形状**：`LongShortRatio { symbol, longRatio, shortRatio, timestamp }`
- **策略**：`getRatio(symbol, interval)` 从 `mockLongShortBySymbol` 查表；
  未命中回退 `0.5/0.5`
- **真实 API 对齐**：接入后改走 `GET /markets/long-short` 系列接口

### WhaleFeedRepository

- **形状**：`WhaleEvent { id, symbol, amountUsd, direction, from/toLabel, timestamp }`
- **策略**：
  - `listRecent(limit)`：取 `mockWhaleEvents` 前 `min(limit, total)` 条
  - `watchFeed`：`Stream.periodic(3s)` 用 `Random(42)` 从 pool 抽样推送
- **Stream 节奏**：`Stream.periodic(Duration(seconds: 3))`
- **真实 API 对齐**：接入后切换到 `whale-alert` SSE/WebSocket 推送

### StrategyRepository

- **形状**：`StrategyCard { id, name, description, pnlPercent, subscribers, tags }`
- **策略**：`listFeatured` / `listMine` / `getDetail` 直接返回
  `mockFeaturedStrategies` / `mockMyStrategies`；`getDetail` 在合集中按 id 查找，
  未命中回退第一条
- **真实 API 对齐**：接入后由 quantify `strategy-plaza` / `strategy-subscriptions` 模块提供

### AiChatRepository

- **形状**：`ChatTurn { id, role, content, timestamp }` + `BacktestSummary`
- **策略**：
  - `sendMessage(turn)`：把入参与 mock 助手回复都 push 进内部 `broadcast`
    `StreamController`，返回助手回复
  - `watchSession(sessionId)`：订阅时先 yield `mockChatTurns` 历史会话，
    再接转 controller
  - **mock 阶段单会话**：`sessionId` 被忽略，所有调用共享同一 `broadcast` controller；
    真实 API 接入时按 sessionId 路由
  - `latestBacktest`：返回 `mockLatestBacktestSummary`
- **真实 API 对齐**：接入后由 quantify `ai` / `llm-strategies` 模块提供

### BacktestRepository

- **形状**：`BacktestRequest` / `BacktestResult { ..., equityCurve }`
- **策略**：`run(request)` / `getResult(id)` 一律返回 `mockBacktestResult`
- **真实 API 对齐**：接入后走 quantify `backtesting` 模块的回测任务接口

### AccountRepository

- **形状**：`AccountInfo { userId, totalEquityUsd, availableBalanceUsd, unrealizedPnlUsd }`
- **策略**：`getInfo` 返回 `mockAccountInfo`；`watchInfo` 用 `Stream.periodic(5s)`
  推同一份快照
- **真实 API 对齐**：接入后由 quantify `accounts` 模块提供 REST + WebSocket

### ApiKeyRepository

- **形状**：`ExchangeApiKey { id, exchange, label, maskedKey, createdAt }`
- **策略**：内存 list 持有 `mockApiKeys` 副本；`listKeys` 返回 unmodifiable 视图；
  `addKey` / `removeKey` 直接在内存上修改
- **真实 API 对齐**：接入后由 quantify `exchange-accounts` 模块提供
