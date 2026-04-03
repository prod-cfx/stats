# Hyperliquid Testnet 交易提交流程排查与打通设计

## 背景

本次目标是在 `staging` 环境中，沿真实用户链路完成一次 AI Quant 策略创建与部署，验证策略是否真正把交易提交到了 `hyperliquid-testnet`，并定位数据流在哪一层中断。

约束如下：

- 先参考当前已经可工作的 `okx` 工作模式，建立成功基准。
- 优先确认是否为现有流程、环境、账户、配置或数据问题，不预设需要改代码。
- 只有在证据充分证明是代码缺陷时，才允许做最小修复。
- 验证码通过 `staging` 本地环境文件中的 `RESEND_API_KEY` 获取，不依赖人工查收邮箱。

## 目标

本次工作必须闭环回答两个问题：

1. `okx` 成功链路的关键证据是什么。
2. `hyperliquid-testnet` 失败或成功的断点具体在哪里，是否需要改代码才能打通。

最终交付不是“猜测性的修复建议”，而是以下两种结果之一：

- 已证明问题不在代码，而在环境、账户、配置、流程条件或运行时状态，并给出证据。
- 已证明问题在代码，完成最小修复并在 `staging` 真实链路中复验通过。

## 调试边界

目标环境固定为 `staging`。

在线调试门禁要求：

- `.env.staging` 存在。
- `.env.staging.local` 存在。
- 默认只读排查，除非进入真实链路中必须触发的正常业务动作。

允许的真实业务动作：

- 无头访问 `https://cfx-www-staging.devbase.cloud/zh/auth/login`
- 使用 `541172405@qq.com` 获取邮箱验证码并登录
- 在 AI Quant 页面发起策略对话、创建策略、部署策略
- 对既有业务流程产生的正常写入进行取证

禁止的动作：

- 在没有证据前先改业务代码
- 为了“验证是否能通”直接绕过前端/代理层人工补写数据库
- 在未确认必要前对线上或准线上依赖做破坏性修改

## 执行策略

采用“基准对照 + 分层取证”方案。

原因：

- 单纯黑盒实操很容易看到“失败”但无法准确定位断点。
- 单纯静态读代码容易被表象误导，尤其这次要求以真实运行结果为准。
- `okx` 已有工作模式，可作为同链路基准，最适合做逐层对照。

执行原则：

1. 先跑通一次 `okx` 基准链路，确认正常样本。
2. 再用同一方式跑 `hyperliquid-testnet` 目标链路。
3. 每经过一层都记录“是否收到输入、是否正确传递、是否收到回执”。
4. 只有证据显示断点在代码层时，才进入修复。

## 目标链路

完整链路如下：

`staging 前端登录 -> Resend 取码 -> AI 对话生成策略 -> 回测/发布 -> 部署到指定交易所账户 -> quantify 创建/绑定订阅 -> signal 生成 -> signal executor 执行 -> tradingService -> 交易所 client -> testnet 回执 -> 本地仓位/执行流水`

排查过程中，任何一个节点都必须回答三个问题：

- 输入是否到达这一层
- 这一层是否把正确数据传给下一层
- 下一层是否返回了成功或明确失败信号

## 五个检查点

### 1. 登录与身份建立

输入：

- 页面：`https://cfx-www-staging.devbase.cloud/zh/auth/login`
- 邮箱：`541172405@qq.com`
- 验证码来源：`.env.staging.local` 中的 `RESEND_API_KEY`

证据：

- 前端登录成功并进入受保护页面
- 浏览器中存在有效登录态
- 后续请求包含有效 session 或 JWT

失败判定：

- 无法从 Resend 获取验证码
- 登录接口失败
- 登录后未建立有效身份

处理原则：

- 本层只查验证码来源、认证接口和登录态，不修改业务代码

### 2. AI 对话建策略

输入：

- 按页面现有 AI Quant 流程发起对话
- 对话内容以“能生成可部署策略”为准，不追求复杂策略本身

证据：

- 后端创建 codegen session
- 会话推进到可发布或已发布状态
- 前端拿到 `publishedStrategyInstanceId` 或等价的可部署实例标识

失败判定：

- 会话停留在草稿
- codegen 失败
- 发布失败
- 前端未形成可部署实例

处理原则：

- 先按现有代码约定构造最小可用对话
- 不因为策略效果一般就偏离链路目标

### 3. 部署与账户绑定

输入：

- 在相同页面流程中选择目标账户部署策略
- 先建立 `okx` 成功样本，再建立 `hyperliquid-testnet` 目标样本

证据：

- `backend` 的 `ai-quant-proxy` 收到 deploy 请求
- `quantify` 成功创建或绑定策略实例、订阅与账户关系
- `exchangeAccountId`、`exchangeId`、`isTestnet` 保持一致
- 策略模式与账户网络属性一致

失败判定：

- 前端根本不允许选择 `hyperliquid`
- deploy 请求未发出
- 代理层未正确透传参数
- 账户绑定或订阅创建失败
- 执行前被模式与网络不匹配门禁拦截

处理原则：

- 本层优先怀疑入口限制、参数透传和账户网络标记，而不是交易所 client

### 4. Signal 到执行器

输入：

- 已部署策略进入可执行状态
- 等待或触发一次真实 signal

证据：

- 生成了 `trading signal`
- `signal-executor` 收到事件
- 执行记录从 `PENDING` 进入 `ORDER_SUBMITTED`、`ORDER_ACKED` 或明确失败状态

失败判定：

- 策略根本没有生成 signal
- 执行器被 `dryRun` 跳过
- 因订阅账户、网络不匹配、资金或风控限制被跳过

处理原则：

- 未进入执行器前，不判定为下单适配器问题

### 5. 交易所下单与回执落库

输入：

- `signal-executor` 已调用 `TradingService.placeOrder()`
- 下游进入 `HyperliquidClient.createOrder()`

证据：

- 实际下单请求参数
- 交易所回执
- 最终订单状态
- 本地执行流水、订单记录、仓位记录
- `hyperliquid-testnet` 环境中可见对应订单或成交

失败判定：

- 调用未到 client
- `symbol` 或 `marketType` 映射错误
- `isTestnet` 网络切换错误
- 签名或 agent 授权失败
- 订单成功但本地账未落

处理原则：

- 只有本层证据闭环后，才能判定为 `hyperliquid` 交易适配器或执行链代码缺陷

## 证据清单

每次执行至少记录以下证据：

- 登录请求与登录后身份状态
- codegen session ID、状态变化、最终发布结果
- deploy 请求体中的 `exchange`、`strategyInstanceId`、`exchangeAccountId`
- `backend ai-quant-proxy` 对 quantify 的转发结果
- `quantify` 侧订阅、账户、策略实例、执行记录关联关系
- signal 生成记录
- signal execution 阶段流转
- `TradingService.placeOrder()` 的输入参数
- `HyperliquidClient` 请求网络与回执
- 本地仓位/订单流水与 testnet 实际订单是否一致

## 改代码门槛

只有满足以下任一条件，才允许改代码：

1. 在同类输入下，`okx` 正常而 `hyperliquid-testnet` 稳定在某一代码层出现确定性分叉。
2. 证据表明某一层已经收到了正确输入，但把数据错误转换或丢失。
3. 已排除环境、账户、验证码、未出 signal、`dryRun`、网络不匹配等运行条件问题。

若不满足上述条件，则只输出根因和运行修正建议，不做代码变更。

## 当前高优先级怀疑点

基于已读代码，进入执行前最值得优先验证的点如下：

1. 前端部署入口是否真的支持选择 `hyperliquid`
2. `exchangeAccountId`、`exchangeId`、`isTestnet` 是否从前端一路传到执行器
3. 策略实例模式 `TESTNET/LIVE/PAPER` 是否与账户 `isTestnet` 发生冲突
4. 策略是否真的生成了 signal，而不是部署成功但没有执行机会
5. `HyperliquidClient` 是否实际连到了 testnet，且 `symbol`/`marketType` 映射正确

## 成功标准

本次设计进入实施后，成功标准定义为：

- 至少形成一条 `okx` 成功基准样本
- 至少形成一条 `hyperliquid-testnet` 真实链路样本
- 明确指出 `hyperliquid-testnet` 断点所在层级
- 若问题属于运行条件，给出修正方式并完成复验
- 若问题属于代码缺陷，完成最小修复并通过真实链路复验

## 非目标

以下内容不在本次范围内：

- 对 AI 策略质量本身做优化
- 顺手重构无关模块
- 扩展新的交易所支持
- 重写登录、codegen 或执行框架

