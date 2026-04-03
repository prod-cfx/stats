# Hyperliquid Testnet 交易提交层穿透调查

Issue: #667
Branch: `codex/fix/667-hyperliquid-testnet-trade-debug`

## 目标
- 在 staging 真实链路中，把 `hyperliquid-testnet` 从 AI 建策略一路穿透到真实下单回执。

## 已验证事实
- staging 登录、Resend 取码、AI 对话、策略发布都可正常完成。
- 前端 AI Quant deploy 入口原先错误拦截了 `hyperliquid`，已修复。
- 旧样本 `cmniqtfat2elnxuqsyc9njixy` 在 `okx` / `hyperliquid` 下都只走到执行器 `SKIPPED`，原因是 `No open position to close for this signal`，没有进入交易所下单层。

## 二次穿透样本
- codegen session: `cmnitku2c075j2vqs77si5idm`
- published strategy instance: `cmnitlvmm083z2vqs6gvqphfv`
- 部署账户: `hyperliquid` testnet account `cmmyuh84q6boxguqscsjvga30`

### 生成脚本关键行为
- 首次无持仓时直接返回 `OPEN_LONG`
- 持仓后仅看止损 / 止盈
- 不会走“无持仓平仓”的旧分支

脚本核心逻辑摘要：
- `if (!hasPosition) return { action: 'OPEN_LONG', ... }`
- `if (isLong && stop/take triggered) return { action: 'CLOSE_LONG', ... }`
- otherwise `NOOP`

## 真实运行结果
- deploy 返回 `201`，策略详情显示 `running`
- 时间线仅有：
  - `创建策略`
  - `开始运行`
  - `订阅策略`
- 在覆盖 `2026-04-03T11:29:39Z` 到 `2026-04-03T11:32:58Z` 的轮询窗口内，没有出现：
  - `信号执行`
  - `信号执行成功`
  - `latestOrders`
  - 持仓变化

## 对照证据
- 同一时间，公开 quantify 接口 `GET /api/v1/ops/trading-signals` 仍在持续产出新 signal。
- 最近样本显示旧实例 `cmnfuon4y08p6g4qs316z00iy` 在 `2026-04-03T11:30:02.781Z` 仍生成了新的 `ENTRY BUY` signal。
- 说明 signal generator 本身没有整体停摆。

## 结论
- 当前阻塞点已经不是策略逻辑，也不是 `hyperliquid` 交易所适配器。
- 新 deploy 的 AI Quant 策略没有进入“当前正在工作并持续产出 signal 的 quantify 运行面”。
- 因此无法继续穿透到 `TradingService.placeOrder()` / `HyperliquidClient.createOrder()`。

## 高概率根因
- staging 上 `cfx-backend-staging` 实际代理到的 quantify upstream，与公开可观测的 `cfx-quantify-stg` 不是同一个有效运行面，或者两者数据面不同步。
- 结果是：
  - backend proxy 视角里，新策略 deploy 成功、详情可见
  - 但 signal generator 所在运行面看不到这个新实例，因此不会生成 signal，更不可能下单

## 建议下一步
- 核对 staging backend 运行时的 `QUANTIFY_API_BASE_URL` / `QUANTIFY_BASE_URL`
- 核对 quantify 运行时连接的数据库/Redis 与公开 `cfx-quantify-stg` 是否一致
- 在真实 quantify 运行面中直接查询以下对象是否存在：
  - `strategy_instances.id = 'cmnitlvmm083z2vqs6gvqphfv'`
  - 对应 `user_strategy_subscriptions`
  - 对应 `strategy_signals`
- 只有先修复这层环境/路由分叉，后续才能继续验证 `hyperliquid-testnet` 真实下单
