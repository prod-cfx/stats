# Quantify 交易执行层设计（Binance 第一批）

## 1. 背景

`apps/quantify` 已经具备量化服务的基础模块拆分，但交易执行层当前仍处于可运行 MVP 状态，核心能力分散在以下模块中：

- `exchange-accounts`：交易所账户绑定与凭据校验
- `trading`：交易所适配与统一下单接口
- `strategy-signals`：策略信号生成与触发执行
- `positions`：本地仓位与成交账本
- `accounts`：策略账户、资金流水、PnL
- `position-sync`：仓位同步与补偿修复

现状问题不在“是否能下单”，而在“是否形成稳定、可恢复、可对账的自动执行闭环”。

## 2. 目标

本设计聚焦交易执行层，不覆盖整个量化平台的全部能力。

本次目标：

- 围绕 `Binance 现货 + Binance 合约` 打通自动执行闭环
- 明确执行编排、交易所适配、本地账本、补偿对账的边界
- 收敛当前模块职责，避免继续在现有模块上叠加临时逻辑
- 为后续扩展 `OKX / Hyperliquid` 保留清晰的通用层骨架

## 3. 非目标

本次不纳入主线范围：

- 手动交易终端
- 复杂订单策略，如撤单、补单、追单、分批执行
- 高阶风控体系
- 全交易所一次性统一重构
- `PAPER` 模式重构

说明：

- `PAPER` 继续保留为现有本地模拟账本能力
- 本次主线只聚焦真实交易所执行语义，即 `TESTNET / LIVE`

## 4. 边界与决策

已确认的关键边界：

- 第一阶段主线为自动执行，不是手动交易终端
- 第一批优先做 `Binance 现货 + Binance 合约`
- 后续以增量方式扩展到 `OKX / Hyperliquid`
- 前端不直接调用 `quantify`
- 第一阶段默认链路是 `backend -> quantify`
- 关于“quantify 是否完全不再信任明文 userId”，允许在三端联调时再锁最终方案，但本设计按“内部服务调用过渡态”预留收口点

## 5. 方案对比与选型

### 5.1 方案 A（选中）：Binance 垂直切片先打透

围绕 `Binance 现货 + 合约` 做完整闭环：

`信号 -> 执行编排 -> Binance 下单 -> 执行记录 -> 本地账本更新 -> 对账补偿`

优点：

- 范围清晰，符合当前职责划分
- 可直接承接现有 `quantify` 代码
- 风险最小，最适合作为第一版产品级交易执行层

缺点：

- 第一版会保留部分 Binance 专属路径
- 后续扩展其他交易所时仍需再抽一轮通用层

### 5.2 方案 B：先做统一执行内核，再接 Binance

优点：

- 架构最整齐
- 对多交易所扩展最友好

缺点：

- 首次改动过大
- 会把当前任务拉进较重的抽象重构

### 5.3 方案 C：沿现状做补丁式修补

优点：

- 见效最快

缺点：

- 继续积累结构性债务
- 无法稳定解决一致性与补偿问题

结论：采用方案 A。

## 6. 当前代码现状盘点

已实现能力：

- 交易所账户绑定、凭据校验、加密存储
- Binance / OKX / Hyperliquid 统一交易适配接口
- 策略信号触发执行
- 本地策略账户、仓位、成交、PnL 账本
- 用户主动平仓
- 仓位估值与日度 PnL
- 手动与定时仓位同步

当前关键缺口：

- 执行成功与本地落账成功之间仍存在缝隙
- `signal-executor` 编排职责过重但状态表达不够清晰
- symbol / marketType 语义未完全统一
- `position-sync` 还在承担过多业务语义
- 多个接口仍直接信任 `userId`

## 7. 目标架构

交易执行层收敛为 5 个块：

### 7.1 Execution Orchestrator

由现有 `signal-executor` 演进而来，负责：

- 读取信号与订阅关系
- 解析目标交易所账户
- 执行前置校验
- 调用交易所适配器下单
- 推动执行记录落库
- 推动本地仓位与资金账本更新
- 触发补偿与对账

这是未来所有交易所共用的通用层。

### 7.2 Broker Adapter

由现有 `trading` 模块承担，职责为：

- 统一下单
- 查询余额、持仓、订单
- 映射 symbol / marketType / side 差异
- 将交易所错误映射为领域异常

这里分为：

- 通用接口层
- Binance 专属 adapter

### 7.3 Portfolio Ledger

由 `positions + accounts` 组成，职责为：

- 管理本地持仓与成交
- 管理策略账户余额、资金流水、PnL
- 提供平台内部账本视角

这层不承担交易所原始真相源职责。

### 7.4 Reconciliation

由 `position-sync` 演进而来，职责为：

- 校验交易所真实状态与本地账本的一致性
- 修复因网络抖动、部分成交、落账失败造成的偏差
- 保存差异日志与后续告警依据

它是补偿与对账层，不是主执行路径。

### 7.5 Account Binding

由 `exchange-accounts` 承担，职责为：

- 管理用户与交易所账户绑定关系
- 校验凭据
- 为执行层提供目标交易所账户

## 8. Binance 专属层与通用层边界

Binance 专属：

- Binance 凭据校验
- Binance symbol 映射
- Binance spot / perp 下单参数映射
- Binance 订单、余额、持仓查询
- Binance 对账规则

未来可复用通用层：

- 执行编排
- 执行状态管理
- 本地仓位账本
- 本地资金账本
- 补偿与对账框架
- 账户绑定模型
- 风控入口

## 9. 核心数据流

一次自动执行应固定为以下主链路：

### 9.1 Signal Ready

策略模块产生可执行信号，至少包含：

- 策略来源
- 标的
- 方向
- 建议仓位信息
- 过期时间
- 幂等语义

### 9.2 Resolve Account

执行编排层根据订阅关系解析：

- 交易所账户
- 本地策略账户

两者缺一不可。

### 9.3 Pre-Check

执行前进行最小校验：

- 订阅是否有效
- 信号是否过期
- 是否重复执行
- 账户是否可用
- 市场类型是否匹配
- 策略账户预算是否足够
- 是否命中基础风控

### 9.4 Place Order

执行编排层调用 Binance adapter 下单。

### 9.5 Persist Execution

交易所返回后，先保存执行记录，避免出现“账本已修改但执行事实丢失”。

### 9.6 Apply Ledger

将真实执行结果映射到本地账本：

- `positions` 更新仓位与成交
- `accounts` 更新手续费、已实现盈亏、权益

### 9.7 Mark Final

只有执行记录与本地账本都完成后，才能标记执行完成。

如果交易所已成功但账本落地失败，则进入“待补偿”语义，而不是简单视为普通失败。

## 10. 保留、修改、补充与收口

### 10.1 保留

- `exchange-accounts`
- `trading`
- `signal-executor`
- `positions`
- `accounts`
- `position-sync`

### 10.2 必须修改

- 收口直接信任 `userId` 的接口模式
- 强化执行记录粒度
- 收紧 `signal-executor` 状态表达
- 统一 symbol / marketType 语义
- 将 `position-sync` 明确定义为补偿层

### 10.3 建议新增

- 更清晰的执行阶段状态
- `exchangeAccountId` 维度的执行落库
- Binance spot / perp 执行配置分层
- 基础风控入口
- 执行失败补偿任务

### 10.4 建议停止扩散

- 新增直接通过明文 `userId` 操作账户/仓位的接口
- 让 `positions` 继续承担执行编排职责
- 把更多交易所细节塞进 `signal-executor`

## 11. 执行状态机

建议保留两层状态：

### 11.1 业务结果状态

- `PENDING`
- `EXECUTED`
- `PARTIAL`
- `FAILED`
- `SKIPPED`

### 11.2 执行阶段状态

建议至少表达：

- `RESOLVED_ACCOUNT`
- `PRECHECK_PASSED`
- `ORDER_SUBMITTED`
- `ORDER_ACKED`
- `LEDGER_APPLIED`
- `RECONCILE_REQUIRED`
- `COMPLETED`

第一版不强制要求立刻新建独立枚举，也可先落在执行记录的 `metadata` 中，但语义必须先统一。

## 12. 异常处理策略

异常按 4 类处理：

### 12.1 Validation / Precheck

如账户不存在、订阅失效、预算不足、symbol 不支持。

结果应为 `SKIPPED` 或明确业务失败。

### 12.2 Exchange Error

如 Binance 认证失败、参数错误、限流、网络失败。

应保留原始错误摘要，但对上层统一成领域异常。

### 12.3 Ledger Error

交易所已成功，但本地仓位或资金账本失败。

这是高优先级异常，必须进入待补偿语义。

### 12.4 Reconciliation Error

对账或补偿失败。

不阻断主请求返回，但必须有执行记录与日志证据。

## 13. 测试策略

第一版测试围绕执行闭环分为 4 层：

### 13.1 Adapter 测试

- Binance spot / perp 下单参数映射
- symbol 转换
- 错误映射

### 13.2 执行编排测试

- 有效信号执行成功
- 重复信号不重复执行
- 账户缺失/订阅失效跳过
- 下单成功但本地落账失败进入补偿语义

### 13.3 本地账本测试

- 开仓、加仓、减仓、平仓
- 手续费记账
- 已实现/未实现盈亏更新

### 13.4 对账测试

- 本地缺仓补建
- 本地多仓关闭
- 数量差异修正
- 差异日志落库

第一期验收至少覆盖：

- Binance spot 自动执行 E2E
- Binance perp 自动执行 E2E
- `signal -> execution -> ledger` 闭环 E2E
- `position-sync` 补偿 E2E

## 14. 里程碑拆分

建议拆为 5 个里程碑：

### 里程碑 1：执行边界收口

- 收口接口边界与 `userId` 传递方式
- 明确模块职责
- 确定统一 symbol 规范

### 里程碑 2：Binance 自动执行主链

- 打通 `signal -> resolve account -> precheck -> place order -> execution record`
- 覆盖 Binance spot / perp

### 里程碑 3：本地账本一致性

- 收紧 `positions + accounts` 落账语义
- 处理手续费、已实现盈亏、权益更新
- 标记“交易所成功、本地失败”的补偿状态

### 里程碑 4：对账与补偿闭环

- 强化 `position-sync`
- 增加执行失败补偿机制
- 让主链失败后可恢复

### 里程碑 5：上线前稳态与扩展预留

- 补齐 Binance spot / perp E2E
- 固化通用层与 Binance 专属层边界
- 为 OKX / Hyperliquid 扩展预留接口

## 15. 风险与控制

- 风险：当前本地 symbol 与交易所统一 symbol 语义不完全一致
  - 控制：在里程碑 1 明确统一规范，并把转换逻辑收敛到 adapter 或独立转换层

- 风险：交易所成功但本地账本失败
  - 控制：执行记录先落库，失败进入补偿语义

- 风险：`position-sync` 继续承担主业务语义
  - 控制：明确其仅为补偿层，不再作为主链真相源

- 风险：后续扩展 OKX / Hyperliquid 时通用层不够干净
  - 控制：本设计明确划出 Binance 专属与可复用层边界

## 16. 后续扩展原则

后续扩展到 `OKX / Hyperliquid` 时，默认复用以下内容：

- Execution Orchestrator
- Portfolio Ledger
- Reconciliation 框架
- Account Binding
- 基础风控入口

仅增量补充：

- 交易所 adapter
- symbol / 参数映射
- 凭据校验逻辑
- 交易所专属对账规则

## 17. 结论

本设计的核心不是“继续给现有模块加几个下单接口”，而是把当前已经存在但分散的执行能力收敛为一条稳定链路：

`信号 -> 编排 -> Binance 执行 -> 执行记录 -> 本地账本 -> 对账补偿`

在这个基础上，`Binance 现货 + Binance 合约` 作为第一批目标，既能形成可落地的产品级闭环，也能为后续扩展其他交易所提供可复用的母版。
