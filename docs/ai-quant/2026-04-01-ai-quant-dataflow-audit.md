# AI Quant Dataflow Audit

## 审计范围

本次只审计 `AI Quant` staging 联调链路，不覆盖站内其它业务模块。

审计主链路：

`自然语言输入 -> LLM codegen/session -> graph/status -> backtesting capability -> create backtest job -> poll job -> read result -> front summary -> full-screen report -> deploy strategy -> strategy list/deployment state`

## 已跑通

- `create backtest job -> quantify runner -> persisted result`
  - 状态：已跑通
  - 文件：
    - `apps/front/src/components/ai-quant/backtest-job-client.ts`
    - `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
    - `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
    - `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
    - `apps/quantify/prisma/schema/backtesting_jobs.prisma`
  - 说明：前端真实创建 job，backend proxy 原样转发，quantify 真实加载 bars、执行策略，并把完整 report 持久化到数据库。

- `poll job -> read result`
  - 状态：已跑通
  - 文件：
    - `apps/front/src/components/ai-quant/backtest-job-client.ts`
    - `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
    - `apps/quantify/src/modules/backtesting/backtesting.controller.ts`
    - `apps/quantify/src/modules/backtesting/jobs/backtest-jobs.service.ts`
  - 说明：`/backtesting/jobs/:id` 与 `/backtesting/jobs/:id/result` 协议保持不变，外部调用方式未被这次持久化改造影响。

- `front summary -> persisted job result resync`
  - 状态：已跑通
  - 文件：
    - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
    - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx`
  - 说明：聊天页中的 `backtestResult` 仍是本地缓存，但现在会按 `jobId` 回拉真实 job result 并刷新摘要，避免本地缓存长期漂移。

- `full-screen report with real live arrays`
  - 状态：已跑通
  - 文件：
    - `apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx`
    - `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx`
    - `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-report-data.ts`
  - 说明：报告页只在拿到真实 `equityCurve + trades` 时渲染完整报告，不再本地拼伪曲线掩盖缺失结果。

## 未打通

- `quantify e2e database-backed verification in current local environment`
  - 状态：代码已接通，本地环境未打通
  - 文件：
    - `apps/quantify/e2e/backtesting/backtesting.e2e-spec.ts`
  - 说明：当前本机缺少有效 `DATABASE_URL`，所以 `quantify` 的 e2e 套件无法在这个会话里完成验证。逻辑层单测、controller 单测和 TypeScript 检查已通过，但 e2e 仍依赖可用测试库。

- `report page explicit reason surfacing`
  - 状态：部分未打通
  - 文件：
    - `apps/front/src/lib/server-api.ts`
    - `apps/front/src/app/[lng]/ai-quant/backtest/[id]/page.tsx`
  - 说明：当前报告页在拿不到结果时已经不会展示伪数据，但仍主要走统一空态，尚未细分“未登录 / job 不存在 / job 未完成 / result 缺失”四类用户可见提示。

- `deploy entity back-reference to sourceBacktestJobId`
  - 状态：未打通
  - 文件：
    - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
    - `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts`
  - 说明：部署后不会删除回测结果，但部署实体本身还没有显式保存“来源于哪次回测”的 `sourceBacktestJobId`。

## 已打通但语义错误

- `DEV_MOCK_EXECUTION_MODE`
  - 状态：已修复
  - 文件：
    - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
  - 说明：已移除。现在回测和部署门槛不再由前端 mock mode 放行。

- `deploy failure -> local mock success fallback`
  - 状态：已修复
  - 文件：
    - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
  - 说明：已删除部署失败时的本地假成功和本地策略落库兜底。staging 下后端失败就明确失败。

- `MOCK SIGNAL` 演示态展示
  - 状态：已修复
  - 文件：
    - `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
  - 说明：已移除，不再向 staging 用户展示 mock signal 语义。

- `summary-only report -> synthetic chart fallback`
  - 状态：已修复
  - 文件：
    - `apps/front/src/app/[lng]/ai-quant/backtest/[id]/BacktestReportClient.tsx`
    - `apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-report-data.ts`
  - 说明：已去掉报告页对伪曲线/伪交易的依赖。现在没有完整真实结果就直接回到空态。

## 本次验证证据

- `quantify`
  - `pnpm exec jest --config ./jest-unit.json src/modules/backtesting/jobs/backtest-jobs.service.spec.ts --runInBand`
  - `pnpm exec jest --config ./jest-unit.json src/modules/backtesting/backtesting.controller.spec.ts --runInBand`
  - `pnpm exec tsc --noEmit --project tsconfig.json`

- `front`
  - `pnpm exec jest --config apps/front/jest.config.ts --runTestsByPath /Users/zengmengdan/coinfulx-new/stats/apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.backtest-jobs.test.tsx /Users/zengmengdan/coinfulx-new/stats/apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.capability-gating.test.tsx /Users/zengmengdan/coinfulx-new/stats/apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx /Users/zengmengdan/coinfulx-new/stats/apps/front/src/app/[lng]/ai-quant/backtest/[id]/backtest-report-data.test.ts --runInBand`

- `backend`
  - `pnpm exec jest --config ./jest-unit.json src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts --runInBand`

## 结论

本次改造后，`AI Quant` staging 的关键数据链路已经收敛到“真实回测、真实结果、真实失败”，并且回测结果不再依赖进程内存临时保存。  
当前仍需后续补完的主要项有两类：

- 有数据库的环境里跑完 `quantify` e2e，完成持久化链路的端到端验证
- 若产品需要更强可追溯性，再把部署实体与 `sourceBacktestJobId` 绑定起来，并补细粒度报告页错误提示
