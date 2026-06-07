# 策略广场真实指标接入 Implementation Plan

**Goal:** `USE_MOCK=false` 时策略广场 hero、detail、signals、equity curve 不再回退 mock，真实字段缺失时走空态或隐藏。
**Track:** B
**Issue:** #2308

## Files

- `apps/quantify/src/modules/strategy-plaza/types/official-strategy-plaza-template.ts`
- `apps/quantify/src/modules/strategy-plaza/dto/strategy-plaza-template.response.dto.ts`
- `apps/backend/src/modules/ai-quant-proxy/dto/strategy-plaza.response.dto.ts`
- `apps/quantify-mobile/lib/data/services/strategy_services.dart`
- `apps/quantify-mobile/lib/data/api/api_strategy_repository.dart`
- `apps/quantify-mobile/lib/data/models/strategy_models.dart`（必要时补 params 模型）
- `apps/quantify-mobile/test/data/api_strategy_repository_test.dart`
- `apps/quantify-mobile/test/pages/strategy_market_page_test.dart`
- `apps/quantify-mobile/test/pages/strategy_detail_page_test.dart`
- 生成契约：`packages/api-contracts/src/generated/*`、`packages/api-contracts-dart/*`（若 `dx build contracts` 可产出）

## Steps

1. RED：改 `api_strategy_repository_test.dart`，证明真实模式会请求 `/strategy-plaza/templates`、`/{id}`、`/{id}/signals`、`/{id}/equity-curve`，且空 signals/equity 返回空集合，不再命中 mock。
2. RED：改 strategy market/detail widget tests，覆盖真实 detail 缺少 signals/equity 时不出现 mock 信号，不画 mock 曲线或走空态。
3. Quantify DTO：在 `StrategyPlazaTemplateResponseDto` 暴露真实展示字段：`displayMetrics` 现有指标、可选 `sparkline`、可选 `params`、可选 `signals`、可选 `equityCurve`。无 schema 改动，仅映射官方模板/证据常量已有数据；signals/equity 可为空数组。
4. Backend proxy DTO：同步 Swagger DTO 字段，保持 backend OpenAPI 与 quantify OpenAPI 形状一致。
5. Mobile service：`StrategyService` 增加真实 OpenAPI path 方法：`listStrategySignals(id, limit)` 和 `getEquityCurve(id, timeframe)`，删除“临时路径注释作为依据”的说法。
6. Mobile repository：删除 `ApiStrategyRepository` 中真实模式 `_fallback` 字段和 hero/detail/signals/equity fallback；把 `displayMetrics` 映射为 stats/detail 指标，把空 signals/equity 映射为空集合。
7. Refactor：抽出 JSON 映射 helpers，保证 `listMarket` 与 `getStrategyDetail` 使用同一真实 DTO 映射，减少特殊分支。
8. GREEN：逐步运行相关 Flutter tests，修复失败。

## Verify

- `dx lint`
- `dx build affected --dev`
- `cd apps/quantify-mobile && flutter analyze --no-pub`
- `cd apps/quantify-mobile && flutter test test/data/api_strategy_repository_test.dart test/pages/strategy_market_page_test.dart test/pages/strategy_detail_page_test.dart`
- 若修改 OpenAPI DTO 后生成器可用：`dx build contracts`

## Commit

单 PR，完整覆盖 Issue #2308 时使用：

```text
feat: 接入策略广场真实详情指标

变更说明：
- 补齐策略广场真实 DTO 字段和 mobile API 映射，移除真实模式 mock fallback
- 增加 signals/equity 空态测试，确保缺数据不显示 mock 内容

Closes: #2308
```
