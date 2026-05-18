# Mock 数据规格

本文档记录 `quantify-mobile` 在 `USE_MOCK` 模式下各 Repository 的数据形状、刷新策略与
真实 API 接入后的对齐要点。

## 启动开关

- 编译期常量：`String.fromEnvironment('USE_MOCK', defaultValue: 'true')`
- 解析策略：**严格只认 `false`（不区分大小写）**；缺省值或任何其它字符串一律视为 mock
- 关闭 mock：`flutter run --dart-define=USE_MOCK=false`
- 关闭 mock 后，未在 PR2 接入真实 API 的 10 个 Repository 调用方法会抛 Dart 内置
  `UnimplementedError`，消息固定格式：`真实 API 待接入: <RepositoryName>`

## PR1 临时态

PR1 仅 `AuthRepository` 提供完整 Mock 闭环作为模式示例；其余 10 个 Repository 在
`useMock=true` 与 `useMock=false` 下均返回 `Unimplemented*Repository` stub。

由于 `lib/pages/` 当前未调用任何 Repository 方法，PR1 合并不会触发任何
`UnimplementedError`，main 仍可正常运行。

PR2 会将下表中标注「PR2 填充」的 10 个 Repository 在 `useMock=true` 分支替换为
`MockXxxRepository`，并提供 fixtures、Stream 节奏（K 线 1s / 巨鲸 3s）等细节。

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

（PR2 填充）

### KlineRepository

（PR2 填充；Stream 节奏：`Stream.periodic(Duration(seconds: 1))`）

### OrderbookRepository

（PR2 填充）

### LongShortRepository

（PR2 填充）

### WhaleFeedRepository

（PR2 填充；Stream 节奏：`Stream.periodic(Duration(seconds: 3))`）

### StrategyRepository

（PR2 填充）

### AiChatRepository

（PR2 填充）

### BacktestRepository

（PR2 填充）

### AccountRepository

（PR2 填充）

### ApiKeyRepository

（PR2 填充）
