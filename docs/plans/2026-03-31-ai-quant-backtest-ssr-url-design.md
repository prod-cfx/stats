# AI Quant 回测全屏页 SSR URL 解析修复设计

日期：2026-03-31  
范围：`apps/front`  
状态：已评审（用户确认）

## 1. 问题定义

在页面 `/{lng}/ai-quant/backtest/{id}` 打开时，服务端拉取回测结果报错：

`Failed to parse URL from /api/v1/backtesting/jobs/<jobId>/result`

根因是服务端执行 `fetch` 时收到相对 URL（`/api/v1/...`）。Node 运行时不接受无基址的相对 URL，因此在 SSR 阶段直接抛错。

## 2. 目标与非目标

### 目标

1. 保持浏览器端现有相对路径代理能力不变。
2. 服务端 API 调用统一使用绝对 URL，消除该类 SSR 报错。
3. 将 URL 解析规则集中在单点，避免各模块重复兜底逻辑。

### 非目标

1. 不重构全站 API 请求层。
2. 不调整回测报告页面 UI 与交互。
3. 不修改后端接口协议。

## 3. 现状与根因

1. `apps/front/src/lib/api-client.ts` 导出 `API_BASE_URL`，其值可为相对路径（例如 `.env.development` 中的 `/api/v1`）。
2. `apps/front/src/lib/server-api.ts` 直接使用该值拼接并调用 `fetch`。
3. 当 `API_BASE_URL` 为相对路径时，服务端请求解析失败。

## 4. 方案对比

### 方案 A（推荐）：分离 CSR 与 SSR 基址导出

在 `api-client.ts` 保留 `API_BASE_URL`（兼容浏览器），新增 `SERVER_API_BASE_URL`（服务端专用且保证绝对 URL）；`server-api.ts` 全部改用后者。

优点：

1. 语义清晰，后续 SSR 调用不再踩坑。
2. 解析规则集中在一处，可维护性高。
3. 不破坏现有前端代理行为。

缺点：

1. 需要改动 2 个文件与测试。

### 方案 B：仅在 `server-api.ts` 局部兜底

在每次请求前检测相对地址并拼接主机。

优点：改动小。  
缺点：逻辑分散，后续新增 server 模块仍可能重复犯错。

### 方案 C：仅改环境变量为绝对 URL

优点：最快止血。  
缺点：配置耦合强，易被后续改动回滚，代码层无防线。

结论：采用方案 A。

## 5. 目标设计

### 5.1 配置解析规则

在 `api-client.ts` 增加规则：

1. 若 `NEXT_PUBLIC_API_BASE_URL` 为绝对 URL，则 `SERVER_API_BASE_URL` 直接使用该值。
2. 若 `NEXT_PUBLIC_API_BASE_URL` 为相对路径（`/` 开头），则服务端用 `NEXT_PUBLIC_API_SERVER_URL`（或默认 `http://localhost:3000`）拼接。
3. 若 `NEXT_PUBLIC_API_BASE_URL` 缺失/占位符，沿用现有回退逻辑，最终得到绝对 URL。

### 5.2 调用方改造

`server-api.ts` 从 `api-client.ts` 引入 `SERVER_API_BASE_URL`，所有 SSR fetch 拼接统一切换到该变量。

### 5.3 向后兼容

浏览器端仍使用现有 `API_BASE_URL`，不会影响当前 `/api/v1` 代理方式。

## 6. 错误处理

本次不新增新的异常类型，仅消除 URL 解析阶段错误；已有的 `!response.ok -> null` 处理保持不变。

## 7. 测试设计（需求驱动）

### 需求-用例映射

1. 相对基址 + SSR：确保 `SERVER_API_BASE_URL` 为绝对 URL。
2. 绝对基址：`SERVER_API_BASE_URL` 与配置一致。
3. 占位符/空值：回退策略兼容现有行为。
4. 页面路径：`/[lng]/ai-quant/backtest/[id]` 在给定参数时可正常渲染，不触发 URL 解析错误。

### 覆盖类型

1. Happy path：有效基址配置。
2. Edge cases：相对路径、占位符、空值。
3. Error handling：避免运行时 URL 解析错误。
4. State transitions：不涉及有状态迁移。

## 8. 交付物

1. `apps/front/src/lib/api-client.ts`（新增服务端绝对基址导出与判定函数）。
2. `apps/front/src/lib/server-api.ts`（切换为服务端基址）。
3. 相关测试文件（`api-client` 单测与必要页面/服务端调用验证）。

## 9. 风险与缓解

1. 风险：`NEXT_PUBLIC_API_SERVER_URL` 配置错误导致请求发往错误主机。  
缓解：保留本地默认回退；测试覆盖相对路径拼接行为。
2. 风险：既有测试仅覆盖 CSR。  
缓解：新增 SSR 语义断言，明确服务端导出行为。

