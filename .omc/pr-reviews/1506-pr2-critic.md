## 审核报告（第 1 轮）

### 概要：Critical 0 / Major 0 / Minor 6

### Critical / Major 问题
无。逐项核验：K 线 1s / 巨鲸 3s stream 严格命中；fakeAsync 正确捕获节奏与 Timer 释放；11 个 provider 终态切换干净；fixtures 字段完全匹配 model；mock-data.md 覆盖 11 个 Repository；未引 codegen。

### Minor 问题

| # | 文件 | 描述 |
|---|------|------|
| M1 | mock_ai_chat_repository.dart | StreamController.broadcast() 持续持有，无 dispose 路径。常驻单例无实际泄漏，但 doc 应登记 |
| M2 | mock_ai_chat_repository.dart | watchSession(sessionId) 忽略 sessionId 多会话回退。doc-only 注明 |
| M3 | mock_kline/ticker/orderbook_repository.dart | unknown symbol 静默回退第一条，doc 应说明 |
| M4 | fixtures/candles.dart | generateSeededCandles 未 assert(count > 0) |
| M5 | mock_orderbook_repository.dart | watchOrderbook bids/asks 不变，仅 timestamp 递增（doc 已说明） |
| M6 | mock_kline_repository.dart | watchCandles 从 baseline 起点推流，非接续 listCandles 最后一根；注释说明 |

### 处理决策

| # | 决策 |
|---|------|
| M1 | 修：文件头注释登记单例语义 |
| M2 | 修：mock-data.md AiChat 段加一句「mock 阶段单会话」 |
| M3 | 修：mock-data.md 相关段加一句「unknown symbol 回退第一条」 |
| M4 | 修：1 行 assert |
| M5 | 拒：doc 已说明，bids/asks 动画属消费侧需求 |
| M6 | 修：mock_kline_repository.dart 注释一行 |
