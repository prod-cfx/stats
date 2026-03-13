# Quantify Message Bus 基础设施接入设计

日期：2026-03-13

## 背景

`apps/quantify/src/modules/message-bus` 是从其他仓库拷贝进来的消息基础设施模块。

当前目录内已经包含：

- `MessageBusModule`
- `MessageBusService`
- `OutboxModule`
- `OutboxRepository`
- `OutboxDispatcher`
- `MessageBusMetricsService`
- `MessageBusDedupeService`
- decorators / dto / topics / event types

但它在 `quantify` 中尚未形成正式、可运行、可验证的基础设施，主要问题包括：

- 依赖契约未闭合：代码依赖 `@nestjs/bull` / `bull`，但 `apps/quantify/package.json` 尚未纳入对应正式依赖
- 路径契约不一致：部分导入仍保留原仓库路径风格，例如 `@/cache/cache.service`
- 数据库契约未确认：`OutboxRepository` 依赖 `outboxMessage` 与 `OutboxStatus`，需要纳入 `quantify` Prisma schema
- 模块接入不完整：`AppModule` 尚未把它作为正式基础设施模块导入
- 运行模式未定义：`dev` / `start` / `build` / `swagger` / `test` 下消息基础设施该如何初始化还未统一
- 验证闭环缺失：当前没有一组明确的基础设施级测试来证明 volatile / reliable / handshake / dedupe / cleanup 可用

本设计的目标不是接入某个具体业务事件，而是先把 `message-bus` 在 `quantify` 中真正接通并保留下来，作为后续业务模块可依赖的正式底座。

## 目标

- `message-bus` 作为 `quantify` 的正式基础设施模块接入
- 保留并接通现有能力：
  - Bull 队列发布
  - Outbox 可靠投递
  - Redis 去重与握手
  - Dispatcher 重试 / 死信 / 清理
  - Metrics 统计
- 底层依赖一并纳入 `quantify` 正式契约：
  - `@nestjs/bull`
  - `bull`
  - Redis 队列配置
  - Prisma `outboxMessage` 表与相关枚举
- `dev` / `start` / `build` / `swagger` / `test` 五类场景具备明确一致的初始化规则
- 提供“基础设施接通并可验证”的最小验证闭环
- 不要求本期绑定真实业务事件

## 非目标

- 不在本期接入首个真实业务发布/消费链路
- 不在本期抽成跨仓库共享 package
- 不重做整套消息架构
- 不替换 Bull 为其他消息系统
- 不引入额外部署架构变更
- 不承诺当前 `dto/` 中所有业务事件定义都已成为 `quantify` 稳定公共契约

## 方案对比

### 方案 1：完整接入并按 `quantify` 现有基础设施做本地化适配

做法：

- 保留当前 `message-bus` 的 `Bull + Outbox + Redis dedupe + Cron dispatcher` 结构
- 统一适配到 `quantify` 的环境变量、配置模块、Redis、Prisma、启动与离线模式
- 把缺失依赖、数据库 schema、模块 wiring、测试链路一次补齐

优点：

- 后续业务模块接消息能力时无需返工底座
- 架构边界清晰，避免“拷贝代码 + 局部兜底”的长期技术债
- 能形成正式、可验证的基础设施合同

代价：

- 本期需要同时改动依赖、Prisma、配置、模块接入与验证链路

结论：推荐。

### 方案 2：先兼容运行，再逐步规范化

做法：

- 以最小改动让当前目录“先跑起来”
- 通过局部兼容与临时适配修补依赖、路径和配置问题

优点：

- 短期改动较小

缺点：

- 会把原仓库契约继续带进 `quantify`
- 后续仍需再做一次正式化清理
- 容易形成“能跑但不稳定”的隐性边界

结论：不推荐。

### 方案 3：先抽成独立基础设施包，再回接 `quantify`

做法：

- 先从 `quantify` 中抽象出通用消息基础设施 package
- 再由 `quantify` 回接这个 package

优点：

- 长期形态最干净

缺点：

- 范围明显放大
- 与当前“先在 quantify 中真正接通并保留下来”的目标不匹配

结论：当前阶段不接受。

## 推荐方案

采用方案 1：完整接入，但本期只交付“基础设施接通并可验证”，不绑定真实业务事件。

## 设计

### 1. 目标边界

本期交付的不是业务链路，而是 `quantify` 内部一套正式可用的消息基础设施，满足以下条件：

- 应用可正常启动，`MessageBusModule` 成为正式模块
- 底层依赖齐全，队列、Redis、Prisma outbox 契约完整
- 不同运行模式有明确行为，不依赖“某一种启动方式恰好可用”
- 有基础设施级验证手段证明核心能力可工作
- 后续业务模块可以在不改底座的前提下接入消息发布/消费

### 2. 模块架构

保留当前四层结构，但重新定义其在 `quantify` 中的正式职责。

#### 2.1 `MessageBusModule`

职责：

- 注册 Bull 队列
- 导出 `MessageBusService`
- 导出 `MessageBusMetricsService`
- 导出 `MessageBusDedupeService`
- 组合 `OutboxModule`

定位：

- `quantify` 的全局基础设施模块，不作为单一业务模块的附属能力

#### 2.2 `OutboxModule`

职责：

- 记录可靠消息
- 领取可投递消息
- 发布到下游队列
- 执行重试、死信与过期清理

依赖：

- `PrismaService`
- `ConfigService`
- `EnvService`
- `MessageBusService`

#### 2.3 `runtime / decorators`

保留现有开发接口：

- `@Publish`
- `@MessageHandler`
- `@IdempotentConsumer`

本期定位：

- 作为基础设施 API 保留并接通
- 不要求本期必须有真实业务消费者

#### 2.4 `dto / topics / types`

保留现有通用消息模型与常量：

- envelope / publish options / topic constants / event type constants

处理原则：

- 通用协议类型作为基础设施一部分正式保留
- 明显来自原仓库业务域的事件 DTO 先留存，但不作为本期稳定公共契约的承诺范围

### 3. 接入位置与依赖关系

`MessageBusModule` 需要在 `AppModule` 中正式导入。

初始化关系遵循以下原则：

- 消息基础设施复用 `quantify` 现有的 Config / Redis / Prisma 能力
- 不在 `message-bus` 内部私自建立第二套环境加载、Redis 连接规则或数据库访问模式
- 模块装配顺序必须与依赖一致，保证：
  - Config 可用
  - Redis/Cache 可用
  - Prisma 可用
  - Schedule 可用
  - Message bus 再进入运行态

推荐装配关系：

1. `ConfigModule`
2. `EnvModule`
3. `CacheModule`
4. `PrismaModule`
5. `ScheduleModule`
6. `MessageBusModule`

说明：

- `MessageBusModule` 使用现有 `CacheService` 与 `RedisService`
- `OutboxDispatcher` 基于 `@nestjs/schedule` 进入运行态
- `MessageBusService` 基于 Bull 队列进行异步投递

### 4. 环境与配置

目标原则：复用 `quantify` 现有 env / config / redis / prisma 契约，不为 message-bus 再开新体系。

#### 4.1 环境变量

保留并正式启用以下配置命名空间：

- `MESSAGEBUS_DEFAULT_MODE`
- `MESSAGEBUS_BACKOFF_DELAY_MS`
- `MESSAGEBUS_OUTBOX_POLL_INTERVAL_MS`
- `MESSAGEBUS_OUTBOX_BATCH_SIZE`
- `MESSAGEBUS_OUTBOX_MAX_ATTEMPTS`
- `MESSAGEBUS_OUTBOX_LOCK_TIMEOUT_SEC`
- `MESSAGEBUS_OUTBOX_BASE_BACKOFF_MS`
- `MESSAGEBUS_OUTBOX_RETAIN_DAYS`
- `MESSAGEBUS_OUTBOX_PUBLISH_ATTEMPTS`
- `MESSAGEBUS_OUTBOX_CANDIDATE_FACTOR`
- `MESSAGEBUS_OUTBOX_CLAIM_MAX_CYCLES`

约束：

- 不再引入原仓库中可能存在的另一套消息总线变量名
- 不允许为 message-bus 额外引入与 `quantify` 现有 env 体系并行的配置源

#### 4.2 Redis

Redis 仍是统一底层服务，但职责拆分明确：

- `RedisService` / `CacheService`：
  - 缓存
  - dedupe 锁
  - handshake 完成标记
- `BullModule.forRootAsync(...)`：
  - 队列连接

原则：

- 两者底层都指向当前 `REDIS_URL`
- 但生命周期与用途分离
- 不把 Bull 直接塞进 `CacheModule`

#### 4.3 Prisma / 数据库

把以下数据库契约纳入 `quantify` 正式 Prisma schema：

- `OutboxStatus`
- `outboxMessage`

最小表字段以当前 repository 需求为准：

- `id`
- `topic`
- `type`
- `payload`
- `status`
- `attempts`
- `nextVisibleAt`
- `lockedBy`
- `lockedAt`
- `lastError`
- `dedupeKey`
- `correlationId`
- `partitionKey`
- `priority`
- `createdAt`
- `updatedAt`

索引原则至少覆盖：

- `status + nextVisibleAt`
- `lockedAt`
- `createdAt`
- 必要时 `dedupeKey`

目的：

- 保证 dispatcher 的 claim 与 cleanup 不依赖全表扫描

#### 4.4 配置加载

`messageBusConfig` 继续由 [`apps/quantify/src/config/configuration.ts`](/Users/zengmengdan/coinfulx-new/stats/apps/quantify/src/config/configuration.ts) 提供。

要求：

- 进入当前全局 config loader
- 所有 message-bus 内部读取统一通过 `ConfigService` 完成
- 不允许消息模块绕过现有配置体系直接手动读另一套 env

#### 4.5 路径与本地化适配

所有从原仓库带来的导入与约定都必须收口到 `quantify` 当前实际工程结构。

原则：

- 只允许使用当前 monorepo 中真实可解析的路径别名
- 优先复用 `common/modules` 与 `common/services`
- 不保留原仓库专用别名作为隐式依赖

### 5. 运行模式设计

#### 5.1 `dev` / `start`

正常运行模式下，`quantify` 启动时应完整初始化：

1. Config
2. Redis / Cache
3. Bull
4. Prisma
5. MessageBusModule
6. OutboxDispatcher

成功标准：

- 应用启动成功
- 队列注册成功
- dispatcher 可进入运行态
- outbox 表可读写

#### 5.2 `build`

构建阶段只要求：

- TypeScript 编译成功
- 路径别名替换成功
- Prisma client / runtime 拷贝完整

约束：

- `build` 不做真实 Redis / Bull / Prisma 网络连接
- `message-bus` 接入不能破坏现有构建链路

#### 5.3 `swagger` / 离线导出

当前 `quantify` 已存在 `SKIP_PRISMA_CONNECT=true` 的离线模式。

本设计要求将其扩展成“基础设施离线模式”：

- `SKIP_PRISMA_CONNECT=true` 时，Prisma 不连库
- Message bus 在离线模式下不进入运行态：
  - 不建立 Bull 队列连接
  - 不启动 dispatcher 定时任务
  - 但 DI 依赖仍可解析，模块可被加载

目的：

- 保证 Swagger / contract / 非 HTTP 导出场景不会因 Redis 或 Bull 初始化失败

实现原则：

- 可以新增一个显式的 message-bus 运行开关
- 也可以在现有离线模式下统一派生“禁用运行态基础设施”
- 但必须保证行为可预测，不能靠模块偶然不触发初始化

### 6. 验证设计

本期不接真实业务事件，但必须形成基础设施级验证闭环。

#### 6.1 Unit

覆盖对象：

- `MessageBusService`
- `OutboxRepository`
- `MessageBusDedupeService`
- `OutboxDispatcher` 的退避与状态流转逻辑

关注点：

- publish 参数组装
- handshake key 生成
- dedupe jobId 构建
- outbox 状态迁移
- backoff 计算

#### 6.2 Integration

验证以下链路：

- outbox record
- claim batch
- publish to queue
- retry
- dead
- cleanup

要求：

- 使用 `quantify` 自身依赖完成，不引入与生产脱节的另一套协议实现

#### 6.3 Bootstrap

验证两类启动模式：

- 正常模式可启动
- 离线模式可启动

重点确认：

- `MessageBusModule` 不破坏正常启动
- `swagger` 等离线场景不被 Bull / Redis / Prisma runtime 绑定卡死

#### 6.4 Smoke

提供一个最小自测链路，仅用于验证基础设施，不绑定业务域。

可接受的形式：

- 测试专用 topic
- 测试专用 handler
- 最小 admin/debug 入口

目的：

- 验证 `volatile`
- 验证 `reliable`
- 验证 `handshake`

### 7. “接通并可验证”的验收定义

满足以下条件才算基础设施接通完成：

- `pnpm --filter @net/quantify run build` 成功
- `pnpm --filter @net/quantify run test` 中新增的 message-bus 测试通过
- `nx run quantify:swagger` 或等价 Swagger 导出命令在离线模式下成功
- 本地启动后可通过最小自测链路证明：
  - 普通 publish 能入队
  - reliable 模式能写 outbox 并被 dispatcher 投递
  - handshake 能收到完成标记
  - dedupe 生效
  - cleanup 能清除过期 SENT 数据

## 错误处理与风险控制

### 错误处理

- Redis 不可用：正常运行模式启动失败，并给出明确错误来源
- 数据库 schema 缺失：启动或 integration 测试直接失败，不允许静默降级
- 离线模式下基础设施被误初始化：视为实现错误，必须通过显式开关或统一运行态判断修复
- 业务 DTO 与当前服务无关：不阻塞基础设施接通，但不纳入首期验证范围

### 风险

- 现有路径别名与原仓库导入混杂，容易出现编译期残留错误
- Bull 与 Cache 共用 Redis，但初始化方式不同，容易出现配置不一致
- Outbox 表加入现有 Prisma schema 后，需要验证不会破坏当前 `quantify` Prisma 生成与构建
- `swagger` / 离线导出是最容易被运行态基础设施误伤的场景

### 风险控制

- 路径适配后使用 grep 检查原仓库残留导入
- 通过 integration test 锁住 outbox 状态流转
- 通过 bootstrap / swagger 验证锁住离线模式
- 先验证基础设施自测链路，再开放给真实业务模块依赖

## 实施顺序

### 里程碑 1：依赖与模块接入

- 补齐 `@nestjs/bull` / `bull`
- 为 Bull 增加正式配置入口
- 在 `AppModule` 中导入 `MessageBusModule`
- 清理原仓库路径与本地化导入问题

验收：

- 代码可编译
- 应用在正常模式可启动到模块装配完成

### 里程碑 2：数据库契约接入

- 在 `quantify` Prisma schema 中加入 `OutboxStatus` 与 `outboxMessage`
- 生成并应用 migration
- 确认 Prisma client 与 repository 对齐

验收：

- outbox repository 可正常读写
- Prisma generate / build 不被破坏

### 里程碑 3：运行模式收口

- 定义并实现正常模式与离线模式的 message-bus 初始化规则
- 让 `build` / `swagger` / `test` 行为稳定可预测

验收：

- 正常模式下基础设施进入运行态
- 离线模式下模块可加载但不触发运行态依赖连接

### 里程碑 4：验证闭环

- 补齐 unit / integration / bootstrap / smoke
- 增加最小自测 topic / handler 或等价验证入口

验收：

- volatile / reliable / handshake / dedupe / cleanup 全部具备基础设施级验证

## 验收标准

以下条件全部满足才可进入实现计划：

- `message-bus` 已被定义为 `quantify` 正式基础设施，而非临时拷贝目录
- `Bull`、Redis、Prisma outbox 契约全部纳入 `quantify` 工程正式依赖
- 正常模式与离线模式具有清晰、稳定、可验证的初始化行为
- 基础设施级测试能够证明核心能力可用
- 本期不绑定具体业务事件，但后续业务接入不需要重做底座
