# quantify-mobile Mock Repository 抽象 Multi-PR Implementation Plan

**Goal:** 为 quantify-mobile 落定 11 个 Repository 抽象 + Mock 实现 + Riverpod providers + USE_MOCK 开关 + fixtures + mock-data.md
**Track:** C (D4/D6/D7 命中，无 D2/D3/D8 硬升级)
**Total PRs:** 2
**Issue:** #1506

## PR 拓扑

| # | PR 标题 | 涵盖 | 依赖 | 哨兵 |
|---|---------|------|------|------|
| 1 | feat(quantify-mobile): #1506 Repository 接口与 mock 基建 (PR1/2) | `lib/data/` 目录结构、11 个 abstract Repository、`MockUnimplementedException`、`useMockProvider` 读取 `USE_MOCK` flag、Provider 集中注册（默认 Mock，flag=false 时 fallback UnimplementedRepository）、`MockAuthRepository` 完整闭环作为模式示例、`mock-data.md` 骨架与"AuthRepository"段、`flutter analyze` + `flutter test` 全过 | - | 否 |
| 2 | feat(quantify-mobile): #1506 10 个 Mock 实现 + Stream + fixtures (PR2/2) | 剩余 10 个 `MockXxxRepository` + fixtures + K 线 1s/巨鲸 3s stream + `mock-data.md` 完整化 + widget test provider override 示例 | PR1 | 否（无后端写入路径） |

理由：PR1 把"接口/基建/示例/USE_MOCK 开关"做完后，独立可 review/可合并/可回滚（即便不接 10 个 mock，main 上也是干净的可编译 lib/data 骨架）；PR2 全部 mock 实现并行实现，单独 review。**不需要哨兵**——纯前端 mock 数据，无数据流跨服务时序。

---

## PR 1: feat(quantify-mobile): #1506 Repository 接口与 mock 基建

### Files
**Create:**
- `apps/quantify-mobile/lib/data/repositories/auth_repository.dart` - AuthRepository abstract
- `apps/quantify-mobile/lib/data/repositories/ticker_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/kline_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/orderbook_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/long_short_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/whale_feed_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/strategy_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/ai_chat_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/backtest_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/account_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/api_key_repository.dart`
- `apps/quantify-mobile/lib/data/repositories/repositories.dart` - barrel
- `apps/quantify-mobile/lib/data/models/auth_models.dart` - AuthSession / Credentials value objects
- `apps/quantify-mobile/lib/data/models/ticker_models.dart` - Ticker / Symbol
- `apps/quantify-mobile/lib/data/models/kline_models.dart` - Candle, KlineInterval
- `apps/quantify-mobile/lib/data/models/orderbook_models.dart` - OrderbookSnapshot, OrderbookLevel
- `apps/quantify-mobile/lib/data/models/long_short_models.dart` - LongShortRatio
- `apps/quantify-mobile/lib/data/models/whale_models.dart` - WhaleEvent
- `apps/quantify-mobile/lib/data/models/strategy_models.dart` - StrategyCard
- `apps/quantify-mobile/lib/data/models/ai_chat_models.dart` - ChatTurn / BacktestSummary（Summary = 给聊天卡片的轻量摘要；与 BacktestResult 区分）
- `apps/quantify-mobile/lib/data/models/backtest_models.dart` - BacktestRequest / BacktestResult（Result = 回测完整结果）
- `apps/quantify-mobile/lib/data/models/account_models.dart` - AccountInfo
- `apps/quantify-mobile/lib/data/models/api_key_models.dart` - ExchangeApiKey
- `apps/quantify-mobile/lib/data/models/models.dart` - barrel
- `apps/quantify-mobile/lib/data/mock/unimplemented_repositories.dart` - 11 个 `Unimplemented{Xxx}Repository`，方法全部 `throw UnimplementedError('真实 API 待接入: XxxRepository')`（Dart 内置 UnimplementedError，对应 issue 验收 #4 字面要求）
- `apps/quantify-mobile/lib/data/mock/mock_auth_repository.dart` - Mock 示例闭环
- `apps/quantify-mobile/lib/data/providers.dart` - useMockProvider + 11 个 providers（10 个先 fallback unimplemented，1 个 Auth 用 Mock）
- `apps/quantify-mobile/test/data/providers_test.dart` - 验证默认 Mock，USE_MOCK=false 时抛 UnimplementedError
- `apps/quantify-mobile/test/data/mock_auth_repository_test.dart`
- `apps/quantify-mobile/docs/mock-data.md` - 骨架 + AuthRepository 段

**Modify:**
- 无（不动 main.dart / 现有 pages，纯增量）

### Tasks

**Task 1.1: 数据模型骨架（value objects）**

- 11 个 model 文件，每个用 `class Xxx { final ...; const Xxx({required ...}); }` 形式
- 不引入 freezed/json_serializable（避开 codegen，本期纯 mock）
- 提供 `Xxx.fromMap` / `toMap` 的占位即可，**简单 const data class**

**Task 1.2: 11 个 abstract Repository 接口**

每个文件结构：
```dart
abstract class AuthRepository {
  Future<AuthSession> login({required String email, required String password});
  Future<void> logout();
  Stream<AuthSession?> watchSession();
}
```

各 Repository 方法签名（最小够用集）：

| Repository | 方法 |
|---|---|
| AuthRepository | login, logout, watchSession |
| TickerRepository | listTickers, watchTicker(symbol) |
| KlineRepository | listCandles({symbol, interval, limit}), watchCandles({symbol, interval}) |
| OrderbookRepository | getSnapshot(symbol), watchOrderbook(symbol) |
| LongShortRepository | getRatio({symbol, interval}) |
| WhaleFeedRepository | listRecent({limit}), watchFeed() |
| StrategyRepository | listFeatured(), listMine(), getDetail(id) |
| AiChatRepository | sendMessage(turn), watchSession(sessionId), latestBacktest(sessionId) |
| BacktestRepository | run(request), getResult(id) |
| AccountRepository | getInfo(), watchInfo() |
| ApiKeyRepository | listKeys(), addKey(key), removeKey(id) |

**Task 1.3: Unimplemented stub 实现（Dart 内置 UnimplementedError）**

> ⚠️ Critic-C1：必须用 Dart 内置 `UnimplementedError`，**不**自造异常类。Issue 验收 #4 原文规定 `UnimplementedError('真实 API 待接入')`，`expect(..., throwsA(isA<UnimplementedError>()))` 才能通过。

```dart
// lib/data/mock/unimplemented_repositories.dart
import '../repositories/repositories.dart';
import '../models/models.dart';

Never _todo(String repo) =>
    throw UnimplementedError('真实 API 待接入: $repo');

class UnimplementedAuthRepository implements AuthRepository {
  @override
  Future<AuthSession> login({required String email, required String password}) =>
      _todo('AuthRepository');
  @override
  Future<void> logout() => _todo('AuthRepository');
  @override
  Stream<AuthSession?> watchSession() => _todo('AuthRepository');
}
// ... 其余 10 个同模式
```

PR1 给 11 个 Unimplemented stub 全部落地（同质重复，约 80 行），保证 USE_MOCK=false 全路径合规。**仅 AuthRepository 同时提供 MockAuthRepository 完整闭环作为模式示例；其余 10 个 PR2 补 Mock 实现**。

**Task 1.4: providers.dart 集中注册**

```dart
// USE_MOCK 解析：严格只认 'false'（小写），其它（缺省/任意字符串）一律视为 mock
const _kUseMockEnv = String.fromEnvironment('USE_MOCK', defaultValue: 'true');
final useMockProvider = Provider<bool>((ref) => _kUseMockEnv.toLowerCase() != 'false');

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  return ref.watch(useMockProvider)
      ? MockAuthRepository()
      : UnimplementedAuthRepository();
});

// 其余 10 个 PR1 仅 Unimplemented stub（PR2 替换为 Mock）：
// 注意：当前 useMock=true 也返回 Unimplemented——不主动调任何方法即不抛；
// pages 当前未调用 Repository（已 grep 验证），合并不破 main。
final tickerRepositoryProvider = Provider<TickerRepository>((ref) {
  return ref.watch(useMockProvider)
      ? UnimplementedTickerRepository()  // PR2 替换为 MockTickerRepository
      : UnimplementedTickerRepository();
});
// ... 其余 9 个同模式
```

> **Critic-M1 修订**：PR1 的 10 个 fallback 在 useMock=true 时也返回 Unimplemented stub；这是 **PR1 临时态**，在 mock-data.md 显式标注"PR2 替换为 Mock"。**Pages 当前未调用 Repository**（已通过 `grep -r Repository lib/pages/` 验证为空），因此 PR1 合并不会触发任何 UnimplementedError 调用路径——main 仍可正常运行。USE_MOCK=false 测试时则主动调任一方法即抛 UnimplementedError，#4 语义保持纯净。

**Task 1.5: MockAuthRepository（示例闭环）**

- 内存存储 `_session`
- `login`：任意 email/password 200ms 后返回固定 `AuthSession(userId: 'mock-user', token: 'mock-token', email: email)`
- `logout`：清空 session
- `watchSession`：StreamController.broadcast 推送

**Task 1.6: 单元 + widget 测试**

`test/data/providers_test.dart`:
- 默认 useMock=true：`container.read(authRepositoryProvider)` 是 MockAuthRepository（不调用方法）
- override `useMockProvider` 为 false：`container.read(authRepositoryProvider).login(...)` 抛 `UnimplementedError`，且消息含 `'真实 API 待接入'`
- 默认 useMock=true：`container.read(tickerRepositoryProvider)` 拿到 Unimplemented stub（不抛——只有调用方法才抛），保持 main 安全
- override useMock=false：`container.read(tickerRepositoryProvider).listTickers()` 抛 `UnimplementedError`

`test/data/mock_auth_repository_test.dart`:
- login 后 watchSession 推 AuthSession
- logout 后 watchSession 推 null

`test/data/provider_override_widget_test.dart`（Critic-M2 必加）:
- 临时一个 `_AuthProbeWidget` 在 build 时 `ref.watch(authRepositoryProvider)` 并 Text 显示 runtimeType
- `testWidgets`：用 `ProviderScope(overrides: [authRepositoryProvider.overrideWithValue(_FakeAuthRepository())])` 渲染 → expect find Fake 类名
- 证明 widget test override 路径在 PR1 已可用（issue 验收 #2）

**Task 1.7: docs/mock-data.md 骨架**

```markdown
# Mock 数据规格

本文档记录 quantify-mobile 在 USE_MOCK 模式下各 Repository 的数据形状与刷新策略。

## 启动开关
...

## Repository 列表
### AuthRepository
形状：AuthSession {userId, token, email}
策略：任意凭据 200ms 延迟登录成功；watchSession StreamController.broadcast。

### TickerRepository
（PR2 填充）
...
```

### Verify

- `dx lint`（如 dx 不覆盖 flutter 则 `cd apps/quantify-mobile && flutter analyze`）
- `flutter test`（apps/quantify-mobile）
- `flutter build apk --debug` 编译通过（可选，PR2 再扩）

### Commit

`feat(quantify-mobile): #1506 Repository 接口集合与 mock 基建 (PR1/2)`

---

## PR 2: feat(quantify-mobile): #1506 10 个 Mock 实现 + Stream + fixtures (PR2/2)

### Files
**Create:**
- `apps/quantify-mobile/lib/data/mock/fixtures/tickers.dart` - 静态行情列表
- `apps/quantify-mobile/lib/data/mock/fixtures/candles.dart` - 种子蜡烛生成器
- `apps/quantify-mobile/lib/data/mock/fixtures/orderbook.dart`
- `apps/quantify-mobile/lib/data/mock/fixtures/long_short.dart`
- `apps/quantify-mobile/lib/data/mock/fixtures/whale_events.dart`
- `apps/quantify-mobile/lib/data/mock/fixtures/strategies.dart`
- `apps/quantify-mobile/lib/data/mock/fixtures/ai_chat.dart`
- `apps/quantify-mobile/lib/data/mock/fixtures/backtest.dart`
- `apps/quantify-mobile/lib/data/mock/fixtures/account.dart`
- `apps/quantify-mobile/lib/data/mock/fixtures/api_key.dart`
- `apps/quantify-mobile/lib/data/mock/mock_ticker_repository.dart`
- `apps/quantify-mobile/lib/data/mock/mock_kline_repository.dart` (1s stream)
- `apps/quantify-mobile/lib/data/mock/mock_orderbook_repository.dart`
- `apps/quantify-mobile/lib/data/mock/mock_long_short_repository.dart`
- `apps/quantify-mobile/lib/data/mock/mock_whale_feed_repository.dart` (3s stream)
- `apps/quantify-mobile/lib/data/mock/mock_strategy_repository.dart`
- `apps/quantify-mobile/lib/data/mock/mock_ai_chat_repository.dart`
- `apps/quantify-mobile/lib/data/mock/mock_backtest_repository.dart`
- `apps/quantify-mobile/lib/data/mock/mock_account_repository.dart`
- `apps/quantify-mobile/lib/data/mock/mock_api_key_repository.dart`
- 单测 10 个对应 `test/data/mock_*_repository_test.dart`
- `test/data/provider_override_widget_test.dart` - widget test 用 provider override 替换 mock

**Modify:**
- `apps/quantify-mobile/lib/data/providers.dart` - 把 10 个 fallback Unimplemented 替换为 Mock
- `apps/quantify-mobile/docs/mock-data.md` - 填充所有 Repository 段

### Tasks（每个 Mock 一个 Task，结构相同）

通用模式：
```dart
class MockTickerRepository implements TickerRepository {
  @override
  Future<List<Ticker>> listTickers() async {
    await Future.delayed(const Duration(milliseconds: 200));
    return mockTickers;
  }
  @override
  Stream<Ticker> watchTicker(String symbol) async* {
    // 取 mockTickers 找 base，每秒推一次 price 抖动
  }
}
```

**Stream 节奏强制**：
- Kline: `Stream.periodic(const Duration(seconds: 1))`，每 tick 产生下一根 candle（基于最后一根 + 随机抖动）
- Whale: `Stream.periodic(const Duration(seconds: 3))`，每 tick 从 fixture pool 随机抽一条

**测试用 seeded Random**：`Random(42)` 保证测试可复现。

### Verify

- `flutter analyze` 干净
- `flutter test` 全过；2 个 stream 用 `fakeAsync` 验证节奏
- `flutter build apk --debug` 编译过
- 手验：默认运行 USE_MOCK=true 路径，调任意 repo 返回 mock；`flutter run --dart-define=USE_MOCK=false` 后调任意 repo 抛 MockUnimplementedException

### Commit

`feat(quantify-mobile): #1506 10 个 Mock Repository 实现与 fixtures (PR2/2)`
