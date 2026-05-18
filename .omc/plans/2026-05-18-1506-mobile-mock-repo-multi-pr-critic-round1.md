## 审核报告（第 1 轮）

### 概要：Critical 1 / Major 2 / Minor 4

### Critical 问题（表）

| # | 位置 | 问题 | 证据 | 建议 |
|---|------|------|------|------|
| C1 | Plan Task 1.3 / 通篇 | **违反 Issue #1506 验收 #4 字面要求**。Issue 原文："`--dart-define=USE_MOCK=false` 启动时，调任一 Repository 抛 `UnimplementedError('真实 API 待接入')`"。Plan 自造 `class MockUnimplementedException implements Exception`，与 Dart 内置 `UnimplementedError`（extends `UnsupportedError` extends `Error`）类型不同，捕获语义与 stacktrace 行为也不同。验收勾选时 `expect(..., throwsA(isA<UnimplementedError>()))` 会失败。 | gh issue view 1506 验收 #4 原文；Plan L94-100；Dart SDK `dart:core` UnimplementedError 定义 | 直接 `throw UnimplementedError('真实 API 待接入: ${repoName}')`；删除自造异常类，或让自造类 `extends UnimplementedError`。两个测试断言改为 `throwsA(isA<UnimplementedError>())`。toString 前缀「真实 API 待接入」必须保留。 |

### Major 问题（表）

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| M1 | PR1 Task 1.4 注释 + Task 1.6 测试 | PR1 在 `useMock=true` 时 10 个非 Auth repo 也抛 unimplemented，与 Issue 验收 #1（"11 个 mock 实现全部落地"）拼到 PR2 才达标。已确认 `apps/quantify-mobile/lib/pages/` 当前无任何 Repository 调用，技术上不破 main。但 plan 把"useMock=true 也抛 unimplemented"作为合规默认，会让 PR1 单独通过 #4 测试的语义歪（#4 限定 USE_MOCK=false 才抛）。 | PR1 的 fallback **只在 `useMock=false` 路径用 Unimplemented**；`useMock=true` 路径同样走 Unimplemented 但在 mock-data.md 标注"PR2 替换"，把 PR1 测试断言改为"useMock=true 时 read 不抛、useMock=false 时调用抛 UnimplementedError"，保持 #4 语义纯净。 |
| M2 | PR2 Files | Riverpod widget test override 示例（验收 #2）拖到 PR2 才落。PR1 仅 ProviderContainer 单测，没证明 widget test override 路径可用。 | PR1 加一个最小 `widgetTest` 用 `ProviderScope(overrides: [authRepositoryProvider.overrideWithValue(_FakeAuth())])` 跑临时 widget，证明 override 在 widget 树成立。 |

### Minor 问题（表）

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| m1 | Task 1.1 + PR2 | `BacktestSummary` 放 `ai_chat_models.dart`，`BacktestResult` 放 `backtest_models.dart`，职责重叠未界定。 | 显式注释"Summary = 给聊天卡片的轻量摘要；Result = 回测完整结果"。 |
| m2 | PR2 | fixture 文件 `api_keys.dart` 复数，model `api_key_models.dart` 单数，不一致。 | 统一；fixture 一律用单数 `api_key.dart`。 |
| m3 | Task 1.2 | AiChatRepository.latestBacktest 与 BacktestRepository.getResult 语义重叠。 | 注释职责差。 |
| m4 | Task 1.4 | `String.fromEnvironment` 解析容错未声明 | 显式只认 `'false'`（小写），其它一律视为 mock，写入 mock-data.md。 |

### 处理决策

| # | 决策 | 备注 |
|---|------|------|
| C1 | 修 | Dart 内置 UnimplementedError，保留中文消息 |
| M1 | 修 | PR1 测试断言重排，useMock=true 路径不主动调方法触发 |
| M2 | 修 | PR1 加最小 widget test |
| m1-m4 | 修 | 顺手 |
