# Plan Critic Round 1 — Issue #2308

## 结论

通过，带 2 个必须在实现中落实的 Major 检查点。

## Major

1. `StrategyService` 默认消费 backend baseUrl。若新增 `/strategy-plaza/templates/:id/signals` 与 `/equity-curve`，必须同时在 backend proxy controller/service/client 与 quantify controller 中存在真实 OpenAPI endpoint；只在 quantify 侧补会导致 mobile 线上 404。
2. DTO 字段要兼容已有 templates list/detail 响应。`signals` 与 `equityCurve` 必须可为空数组或缺省，不得让老响应因为必填字段破坏客户端解析。

## Minor

1. `StrategyDetail.params` 当前模型未显式存在；实现可先用现有 card 字段渲染参数区，必要时另加可选字段，但不要大改 UI。
2. `dx build contracts` 是否必跑取决于生成器耗时和是否更新生成产物；若 DTO/OpenAPI 变更，应该执行并提交产物。

## Gate

Critical: 0
Major: 2（已纳入实现约束）
Minor: 2

Track B 一轮 critic 通过，可以进入实现。
