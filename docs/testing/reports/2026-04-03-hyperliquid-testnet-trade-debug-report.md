# Hyperliquid Testnet 交易提交流程调试报告

Issue: #667
Branch: `codex/fix/667-hyperliquid-testnet-trade-debug`
Spec: `docs/superpowers/specs/2026-04-03-hyperliquid-testnet-trade-debug-design.md`

## 环境门禁
- Target env: `staging`
- `.env.staging`: present
- `.env.staging.local`: present

## 预检查
- 前端 deploy 入口是否允许 `hyperliquid`: 否。`apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx` 当前 `onSelectExchange` 仅接受 `binance` 和 `okx`。
- deploy 参数是否完整透传: 是。`backend ai-quant-proxy` 与 controller 当前会透传 `exchange`、`strategyInstanceId`、`exchangeAccountId`、`exchangeAccountName`。
- executor 是否会因网络模式不匹配而跳过: 是。`signal-executor` 会对 `TESTNET/LIVE` 与 `exchangeAccount.isTestnet` 做硬匹配，若不一致直接失败。
- Hyperliquid client 是否按 `isTestnet` 切换网络: 是。`HyperliquidClient` 构造时使用 `config.isTestnet` 控制 testnet/mainnet endpoint。

## OKX 基准样本
- 登录: 使用 `.env.staging.local` 中的 `RESEND_API_KEY` 调 Resend API 拉取 6 位验证码，无头登录 `https://cfx-www-staging.devbase.cloud/zh/auth/login` 成功，最终落到 `/zh/account`；登录态已保存到 `/tmp/cfx-staging-auth-state.json`。
- Codegen: 通过 `/api/v1/llm-strategy-codegen/sessions` 与 `/messages` 完成一轮真实对话，session `cmniqrfn32cotxuqsvf2hih9n` 最终进入 `PUBLISHED`，生成策略实例 `cmniqtfat2elnxuqsyc9njixy`。
- Deploy: 通过 backend proxy `POST /api/v1/account/ai-quant/strategies/deploy`，以 `okx` 账户 `cmmyugy3v6b8pguqsb5p6uib7` 成功部署，HTTP `201`，策略状态 `running`。
- Signal: 部署后在策略详情时间线中看到 `信号执行` 事件。
- Execution: 时间线事件 note 为 `No open position to close for this signal`，说明执行器已消费到 signal，但在准备平仓时因不存在可关闭持仓而 `SKIPPED`。
- Exchange result: `latestOrders = []`，没有任何订单进入交易所提交层。

## Hyperliquid Testnet 样本
- 登录: 复用同一 staging 登录态。
- Codegen: 复用已发布策略实例 `cmniqtfat2elnxuqsyc9njixy`。
- Deploy: 通过 backend proxy 以 `hyperliquid` 账户 `cmmyuh84q6boxguqscsjvga30` 成功部署，HTTP `201`，策略状态 `running`，账户名 `1212`。
- Signal: 在同一策略实例切到 `hyperliquid` 后，时间线保留同一条 `信号执行` 事件。
- Execution: 同样停在执行器 `SKIPPED`，note 仍为 `No open position to close for this signal`。
- Exchange result: `latestOrders = []`，没有证据显示调用已进入 `TradingService.placeOrder()` / `HyperliquidClient.createOrder()`。

## 断点结论
- Layer: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts` 的平仓预检查分支，位于交易所 client 调用之前。
- Root cause: 这次真实样本触发的是平仓信号，但账户上没有可关闭持仓，执行器按设计写入 `SKIPPED` 执行记录并返回；因此根本没有订单进入 OKX 或 Hyperliquid 提交层。`hyperliquid-testnet` 本次“不通”并非交易所适配器故障。
- Evidence:
  - `okx` 与 `hyperliquid` 两条链路都能成功 deploy，说明账户绑定与 deploy 透传正常。
  - 两条链路都出现同一条时间线事件 `信号执行 / No open position to close for this signal`，说明断点在交易所无关的公共执行层。
  - 代码中该 note 来自 `signal-executor.service.ts`，在 `findOpenPositionForClose()` 找不到持仓时创建 `status = 'SKIPPED'` 执行记录并直接返回。
  - 策略详情页时间线由 `account-strategy-view.service.ts` 把非成功执行映射为 `event = '信号执行'`、`note = execution.errorMessage`，与 staging 观测结果一致。
  - staging `ops/trading-signals` 查询接口对 `strategyInstanceId` 过滤看起来未生效，不能作为本次断点判断依据。

## 修复前后对比
- Before: 前端 AI Quant 部署弹窗在 `AiQuantPageClient` 中只接受 `binance` / `okx`，即使用户已绑定 `hyperliquid` 账户，也无法通过页面切换到 `hyperliquid` 部署。
- After: 部署弹窗允许选择 `hyperliquid`，与 `DeployDialog`、账户状态接口和后端 deploy 能力保持一致。
- Changed layer: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Residual risk: 这次样本没有构造出真实开仓信号，所以尚未拿到 `HyperliquidClient.createOrder()` 成功或失败回执；如果要继续验证交易所提交流程，需要再构造一个能稳定产生开仓信号的策略样本或在账户中预置持仓以覆盖平仓路径。

## 处置结果
- Runtime fix only / Code fix: 两者都有。运行态结论是断点不在交易所提交层；代码侧修复了一个已确认的前端 deploy 入口 bug。
- Verification:
  - `dx test unit front AiQuantPageClient.deploy-guard.test.tsx -t "submits hyperliquid when the user switches deploy exchange to hyperliquid"`
  - `dx test unit front AiQuantPageClient.deploy-guard.test.tsx`
