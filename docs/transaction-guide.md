# NestJS + Prisma 声明式事务方案指南

> 本文档面向需要在 NestJS + Prisma 项目中落地声明式事务管理的开发团队。
> 方案基于 `nestjs-cls` 生态，实现了 **零参数传递、装饰器驱动、afterCommit 安全回调** 三大核心能力。

---

## 目录

1. [方案概览](#1-方案概览)
2. [核心依赖](#2-核心依赖)
3. [架构原理](#3-架构原理)
4. [安装与配置](#4-安装与配置)
5. [分层规范](#5-分层规范)
6. [使用指南](#6-使用指南)
7. [afterCommit 机制](#7-aftercommit-机制)
8. [禁止事项](#8-禁止事项)
9. [决策树速查](#9-决策树速查)
10. [常见问题](#10-常见问题)

---

## 1. 方案概览

### 解决什么问题

传统 Prisma 事务需要手动将 `tx` 客户端层层传递：

```typescript
// 传统方式 — tx 参数污染整条调用链
async createOrder(dto: CreateOrderDto) {
  return this.prisma.$transaction(async (tx) => {
    const order = await this.orderRepo.create(tx, dto)     // 传 tx
    await this.walletService.deduct(tx, order.userId, ...)  // 传 tx
    await this.activityService.log(tx, ...)                 // 传 tx
    return order
  })
}
```

**问题**：每个方法都要额外接收 `tx` 参数，Service 之间互相调用时签名膨胀，且容易遗漏导致部分操作跑在事务外。

### 我们的方案

```typescript
// 声明式 — 装饰器开启事务，Repository 自动参与
@Transactional()
async createOrder(@Body() dto: CreateOrderDto) {
  const order = await this.orderService.create(dto)  // 无需传 tx
  return order
}

// Repository 内部 — 自动获取当前事务客户端
async create(data: CreateOrderData) {
  return this.txHost.tx.order.create({ data })  // txHost.tx 自动感知事务
}
```

**核心思路**：利用 Node.js 的 AsyncLocalStorage（CLS）在请求级别存储事务客户端引用，Repository 通过 `txHost.tx` 自动获取，整条调用链无需传递任何事务参数。

---

## 2. 核心依赖

| 包名 | 版本 | 作用 |
|------|------|------|
| `nestjs-cls` | ^6.x | 提供请求级别的 CLS (Continuation-Local Storage) 上下文 |
| `@nestjs-cls/transactional` | ^3.x | 在 CLS 上下文中管理事务生命周期，提供 `@Transactional()` 装饰器 |
| `@nestjs-cls/transactional-adapter-prisma` | ^1.x | 将 Prisma 的 `$transaction` 接入 CLS 事务机制 |

```bash
pnpm add nestjs-cls @nestjs-cls/transactional @nestjs-cls/transactional-adapter-prisma
```

> 这三个包的关系：`nestjs-cls` 是基础层（管理 AsyncLocalStorage）；`@nestjs-cls/transactional` 是事务抽象层（装饰器 + 传播语义）；`adapter-prisma` 是 Prisma 专用适配器（将 Prisma interactive transaction 桥接到 CLS）。

---

## 3. 架构原理

### 数据流

```
HTTP 请求进入
  │
  ▼
ClsMiddleware 创建 CLS 上下文（AsyncLocalStorage）
  │
  ▼
Controller 方法标注 @Transactional() / @Transactional()
  │
  ▼
@Transactional() 拦截方法执行：
  ├─ 调用 prisma.$transaction(async (tx) => { ... })
  ├─ 将 tx 存入 CLS 上下文
  ├─ 执行 Controller 方法体
  │     │
  │     ▼
  │   Service 执行业务逻辑（无需感知事务）
  │     │
  │     ▼
  │   Repository 通过 txHost.tx 从 CLS 取出 tx 客户端
  │     │
  │     ▼
  │   数据库操作自动在事务内执行
  │
  ├─ 方法正常返回 → 事务提交（COMMIT）
  └─ 方法抛异常 → 事务回滚（ROLLBACK）
  │
  ▼
AfterCommitInterceptor 执行排队的 afterCommit 任务（所有请求自动 drain）
```

### 关键机制

| 机制 | 说明 |
|------|------|
| CLS 上下文 | 基于 Node.js `AsyncLocalStorage`，每个请求独立的存储空间，异步调用链自动传播 |
| `txHost.tx` | 有活跃事务时返回事务客户端，无事务时返回普通 PrismaClient — Repository 不需要关心自己是否在事务中 |
| afterCommit | 自研机制，将副作用回调存入 CLS 队列，事务提交后由拦截器统一执行 |

---

## 4. 安装与配置

### 4.1 CLS 模块配置

创建 `src/common/modules/cls.module.ts`：

```typescript
import { Module } from '@nestjs/common'
import { ClsModule } from 'nestjs-cls'
import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import { PrismaService } from '@/prisma/prisma.service'

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: { mount: false }, // 手动挂载中间件，避免通配符路由冲突
      plugins: [
        new ClsPluginTransactional({
          imports: [],  // 如果 PrismaModule 是 @Global()，这里留空即可
          adapter: new TransactionalAdapterPrisma({
            prismaInjectionToken: PrismaService,
          }),
        }),
      ],
    }),
  ],
  exports: [ClsModule],
})
export class ClsConfigModule {}
```

### 4.2 PrismaModule 注册 TransactionEventsService

```typescript
import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'
import { TransactionEventsService } from '@/common/services/transaction-events.service'

@Global()
@Module({
  providers: [PrismaService, TransactionEventsService],
  exports: [PrismaService, TransactionEventsService],
})
export class PrismaModule {}
```

### 4.3 AppModule 注册

```typescript
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { ClsMiddleware } from 'nestjs-cls'
import { ClsConfigModule } from './common/modules/cls.module'
import { AfterCommitInterceptor } from './common/interceptors/after-commit.interceptor'

@Module({
  imports: [
    ClsConfigModule,
    PrismaModule,
    // ... 其他模块
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AfterCommitInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // 手动挂载 CLS 中间件到所有路由
    consumer.apply(ClsMiddleware).forRoutes('*')
  }
}
```

### 4.4 自研组件（需自行创建）

项目需要 2 个自研文件来支撑 afterCommit 机制：

#### (a) afterCommit 拦截器 `src/common/interceptors/after-commit.interceptor.ts`

全局注册，所有请求结束后自动 drain afterCommit 任务队列。无事务时队列为空，开销为零。

```typescript
import { Injectable, CallHandler, ExecutionContext, Logger, NestInterceptor } from '@nestjs/common'
import { Observable } from 'rxjs'
import { tap } from 'rxjs/operators'
import { TransactionEventsService } from '../services/transaction-events.service'

@Injectable()
export class AfterCommitInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AfterCommitInterceptor.name)

  constructor(
    private readonly txEvents: TransactionEventsService,
  ) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    this.txEvents.reset()

    return next.handle().pipe(
      tap(() => {
        const tasks = this.txEvents.drainAfterCommitTasks()
        if (tasks.length > 0) {
          this.txEvents.runTasks(tasks).catch(err => {
            this.logger.error('afterCommit drain failed', err)
          })
        }
      }),
    )
  }
}
```

#### (c) 事务事件服务 `src/common/services/transaction-events.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common'
import { ClsService } from 'nestjs-cls'
import { TransactionHost } from '@nestjs-cls/transactional'
import { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'

const AFTER_COMMIT_TASKS_KEY = 'AFTER_COMMIT_TASKS'

type Task = () => void | Promise<void>

@Injectable()
export class TransactionEventsService {
  private readonly logger = new Logger(TransactionEventsService.name)

  constructor(
    private readonly cls: ClsService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  /**
   * 注册一个在事务提交后执行的回调。
   * - 在事务中：存入 CLS 队列，等事务提交后由拦截器/withAfterCommit drain
   * - 不在事务中：立即异步执行（fallback）
   */
  afterCommit(task: Task): void {
    const inTx = this.txHost.isTransactionActive()

    if (!inTx) {
      Promise.resolve()
        .then(() => task())
        .catch(error => {
          this.logger.warn(`afterCommit fallback task failed: ${error?.message}`)
        })
      return
    }

    const list = (this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []
    list.push(task)
    this.cls.set(AFTER_COMMIT_TASKS_KEY, list)
  }

  drainAfterCommitTasks(): Task[] {
    const list = ((this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []).slice()
    this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
    return list
  }

  async runTasks(tasks: Task[]): Promise<{ success: number; failed: number; errors: Error[] }> {
    let success = 0
    const errors: Error[] = []
    for (const task of tasks) {
      try {
        await task()
        success++
      } catch (error) {
        const err = error as Error
        errors.push(err)
        this.logger.error(`afterCommit task failed: ${err.message}`, err.stack)
      }
    }
    return { success, failed: errors.length, errors }
  }

  reset(): void {
    this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
  }

  /**
   * 非 HTTP 场景（Bull Job / Subscriber / Scheduler）的便捷方法。
   * 自动创建 CLS 上下文 + 开启事务 + drain afterCommit。
   */
  async withAfterCommit<T>(fn: () => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      this.reset()
      const result = await this.txHost.withTransaction(fn)
      const tasks = this.drainAfterCommitTasks()
      await this.runTasks(tasks)
      return result
    }

    if (this.cls.isActive()) {
      return execute()
    }
    return this.cls.run(execute)
  }
}
```

---

## 5. 分层规范

### 总体原则

```
Controller  →  开启事务边界（装饰器）
Service     →  纯业务逻辑（不开启事务，声明传播约束）
Repository  →  数据访问（通过 txHost.tx 透明参与事务）
```

### 各层职责

| 层 | 事务职责 | 允许的操作 |
|----|---------|-----------|
| **Controller** | 事务的唯一入口 | 使用 `@Transactional()`，afterCommit 自动支持 |
| **Service** | 透明参与（不使用传播装饰器） | 一般 Service 不加事务装饰器，依赖 Controller 层保证事务。需要显式事务控制的场景（advisory lock、嵌套事务）可注入 `txHost` 并使用 `txHost.withTransaction()` |
| **Repository** | 透明参与 | 通过 `this.txHost.tx` 获取当前客户端，不关心是否在事务中 |

### 传播类型速查

| 传播类型 | 含义 | 允许在哪层使用 |
|---------|------|--------------|
| `Required`（默认） | 没有事务就新建一个 | **仅 Controller** |
| `Mandatory` | 必须已有事务，否则抛异常 | Service（可选，当前项目未采用） |
| `Supports` | 有事务就加入，没有就不开 | Service（可选，当前项目未采用） |
| `RequiresNew` | 总是新建独立事务 | **禁止在 Service 使用** |
| `Nested` | 嵌套事务（savepoint） | **禁止在 Service 使用** |

> **铁律**：Service 层禁止使用 `Required`、`RequiresNew`、`Nested` 等会自行创建事务的传播类型。事务边界只在 Controller 层开启。

---

## 6. 使用指南

### 6.1 基础场景 — 只需要事务，不需要 afterCommit

```typescript
// Controller
@Post()
@Transactional()  // ← 开启事务
async createUser(@Body() dto: CreateUserDto) {
  return this.userService.create(dto)
}

// Service
@Injectable()
export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async create(dto: CreateUserDto) {
    // 纯业务逻辑，不需要感知事务
    return this.userRepo.create({ name: dto.name, email: dto.email })
  }
}

// Repository
@Injectable()
export class UserRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  async create(data: { name: string; email: string }) {
    return this.txHost.tx.user.create({ data })  // ← 自动参与事务
  }
}
```

### 6.2 需要 afterCommit — 事务提交后发事件/发通知

```typescript
// Controller
@Post()
@Transactional()  // ← 事务 + afterCommit 支持
async register(@Body() dto: RegisterDto) {
  return this.authService.register(dto)
}

// Service
@Injectable()
export class AuthService {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly txEvents: TransactionEventsService,
    private readonly eventBus: EventBusService,
  ) {}

  async register(dto: RegisterDto) {
    const user = await this.userRepo.create(dto)

    // 注册 afterCommit 回调 — 事务提交后才会执行
    // 如果事务回滚，这个回调不会执行
    this.txEvents.afterCommit(() => {
      this.eventBus.publish(new UserRegisteredEvent(user.id))
    })

    return user
  }
}
```

### 6.3 非 HTTP 场景 — Bull Job / Subscriber / Scheduler

```typescript
@Processor('billing')
export class BillingProcessor {
  constructor(private readonly txEvents: TransactionEventsService) {}

  @Process('deduct')
  async handleDeduct(job: Job<DeductPayload>) {
    // withAfterCommit 会自动：
    // 1. 创建 CLS 上下文（Bull Job 没有 HTTP 中间件）
    // 2. 开启 Prisma 事务
    // 3. 事务提交后执行 afterCommit 队列
    await this.txEvents.withAfterCommit(async () => {
      await this.walletService.deduct(job.data)

      this.txEvents.afterCommit(() => {
        this.eventBus.publish(new DeductCompletedEvent(job.data.id))
      })
    })
  }
}
```

### 6.4 Service 声明传播约束（推荐实践）

```typescript
@Injectable()
export class WalletService {
  constructor(private readonly walletRepo: WalletRepository) {}

  // 声明：这个方法必须在事务中被调用
  // 如果不在事务中调用会立即抛出异常，而不是静默执行
  @Transactional(Propagation.Mandatory)
  async deduct(userId: string, amount: number) {
    const wallet = await this.walletRepo.findByUserId(userId)
    if (wallet.balance < amount) throw new InsufficientBalanceException()
    return this.walletRepo.updateBalance(userId, -amount)
  }

  // 声明：有事务就加入，没事务也能正常运行
  @Transactional(Propagation.Supports)
  async getBalance(userId: string) {
    return this.walletRepo.findByUserId(userId)
  }
}
```

---

## 7. afterCommit 机制

### 为什么需要 afterCommit

事务中直接执行外部副作用（发消息、调用第三方 API、发布事件）存在风险：

```
事务开始
  ├─ 创建订单          ✅
  ├─ 扣减余额          ✅
  ├─ 发送通知 ← 外部调用   ✅ 已发送
  └─ 更新库存          ❌ 失败！事务回滚
                          但通知已经发出去了，无法撤回！
```

afterCommit 确保副作用只在事务成功提交后才执行：

```
事务开始
  ├─ 创建订单          ✅
  ├─ 扣减余额          ✅
  ├─ 注册 afterCommit(发送通知)  ← 只是注册，不执行
  └─ 更新库存          ❌ 失败！事务回滚
                          afterCommit 队列被丢弃，通知不会发送
```

### 两条触发路径

| 场景 | 事务开启方式 | afterCommit 触发方式 |
|------|------------|---------------------|
| HTTP 请求 | `@Transactional()` | `AfterCommitInterceptor` 全局注册，handler 返回后自动 drain |
| 非 HTTP（Bull Job 等） | `txEvents.withAfterCommit(fn)` | `withAfterCommit()` 内部在事务提交后自动 drain |

### 时序保证

```
@Transactional() → ClsPluginTransactional 触发 Prisma.$transaction()
  │
  ├─ 方法体执行，txEvents.afterCommit() 注册回调到 CLS 队列
  │
  ├─ 方法体正常返回 → Prisma.$transaction() COMMIT
  │                                │
  │                                ▼
  │                    AfterCommitInterceptor.tap()
  │                    取出 CLS 队列中的所有回调并依次执行
  │
  └─ 方法体抛异常 → Prisma.$transaction() ROLLBACK
                     CLS 队列被遗弃，回调永远不会执行 ✅
```

---

## 8. 禁止事项

### 绝对禁止

| 禁止项 | 原因 |
|--------|------|
| Service 使用 `@Transactional()` （无传播参数） | 默认传播是 `Required`，会自行创建事务，破坏"Controller 统一开事务"原则 |
| Service 使用 `Propagation.RequiresNew` / `Propagation.Nested` | 会创建独立/嵌套事务，事务边界不可控 |
| 事务内直接执行外部 I/O | 发消息、HTTP 调用、文件写入等必须用 `txEvents.afterCommit()` 包装 |
| SSE / Stream 方法使用事务装饰器 | `tap()` 会在流的第一个值发出时触发 drain，时序不安全 |
| Repository 注入 `PrismaService` 直接使用 | 绕过了 CLS 事务机制，必须用 `txHost.tx` |

### 容易犯的错误

```typescript
// ❌ 错误：Service 自行开启事务
@Transactional()  // 默认 Required，会新建事务
async transfer(from: string, to: string, amount: number) { ... }

// ✅ 正确：Service 声明必须在事务中调用
@Transactional(Propagation.Mandatory)
async transfer(from: string, to: string, amount: number) { ... }
```

```typescript
// ❌ 错误：事务内直接发消息
@Transactional()
async createOrder(dto: CreateOrderDto) {
  const order = await this.orderRepo.create(dto)
  await this.emailService.send(order.userEmail, '订单创建成功')  // 事务回滚后邮件已发
  return order
}

// ✅ 正确：用 afterCommit 延迟发送
@Transactional()
async createOrder(dto: CreateOrderDto) {
  const order = await this.orderRepo.create(dto)
  this.txEvents.afterCommit(() => {
    this.emailService.send(order.userEmail, '订单创建成功')
  })
  return order
}
```

```typescript
// ❌ 错误：Repository 直接注入 PrismaService
constructor(private readonly prisma: PrismaService) {}

async findById(id: string) {
  return this.prisma.user.findUnique({ where: { id } })  // 绕过事务！
}

// ✅ 正确：Repository 使用 txHost
constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma>) {}

async findById(id: string) {
  return this.txHost.tx.user.findUnique({ where: { id } })  // 自动参与事务
}
```

---

## 9. 决策树速查

开发时遇到事务相关决策，按此流程判断：

```
这个方法需要事务吗？
├─ 不需要（只读查询）→ 不加任何装饰器
└─ 需要
   ├─ 这是 Controller 方法吗？
   │  ├─ 是 → @Transactional()（有外部副作用时配合 txEvents.afterCommit()）
   │  └─ 不是 Controller（是 Service）
   │     ├─ 这个方法必须在事务中运行？ → @Transactional(Propagation.Mandatory)
   │     └─ 有没有事务都行？ → @Transactional(Propagation.Supports)
   │
   └─ 这是非 HTTP 场景（Bull Job / Subscriber）？
      └─ 用 txEvents.withAfterCommit(async () => { ... })
```

---

## 10. 常见问题

### Q: 如果我忘了在 Controller 加 @Transactional() 会怎样？

`txHost.tx` 在没有活跃事务时返回普通 PrismaClient，所有操作正常执行但不在事务中。这意味着不会报错，但也没有原子性保证。

**当前约定**：Service 层不使用 `Propagation.Mandatory` 装饰器（KISS 原则）。如果需要更强的安全网，可以对关键 Service 方法加 `@Transactional(Propagation.Mandatory)`，这样 Controller 忘加事务时运行时会立即报错。

### Q: 事务超时怎么配置？

在 CLS 模块配置中设置 Prisma 适配器的超时：

```typescript
adapter: new TransactionalAdapterPrisma({
  prismaInjectionToken: PrismaService,
  defaultTxOptions: {
    timeout: 10000,       // 10 秒超时
    isolationLevel: 'ReadCommitted',
  },
}),
```

### Q: 能在一个事务中嵌套另一个事务吗？

默认传播类型是 `Required`：如果已有事务就加入，没有就新建。所以不会真的嵌套，而是加入外层事务。这正是我们想要的行为。

### Q: afterCommit 任务失败了怎么办？

单个 afterCommit 任务失败不影响其他任务的执行（`runTasks` 逐个 try-catch）。失败会记录 error 级别日志。对于关键任务（如计费），建议在 afterCommit 回调内部加入重试或持久化机制。

### Q: E2E 测试中事务怎么处理？

E2E 测试走完整的 HTTP 请求链路，CLS 中间件和事务装饰器正常生效，不需要特殊处理。每个测试用例的数据库操作在独立的请求事务中完成。

---

## 附录：文件清单

落地此方案需要创建/修改的文件：

```
src/
├── common/
│   ├── modules/
│   │   └── cls.module.ts                          # CLS + 事务插件配置
│   ├── interceptors/
│   │   └── after-commit.interceptor.ts            # afterCommit 拦截器
│   └── services/
│       └── transaction-events.service.ts          # afterCommit 任务队列服务
├── prisma/
│   └── prisma.module.ts                           # 注册 TransactionEventsService
└── app.module.ts                                  # 注册 ClsConfigModule + 全局拦截器 + CLS 中间件
```
