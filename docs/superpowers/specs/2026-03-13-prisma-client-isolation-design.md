# Backend / Quantify Prisma Client 隔离设计

日期：2026-03-13

## 背景

当前 `apps/backend` 与 `apps/quantify` 都通过 Prisma 默认配置生成到共享的 `@prisma/client` 输出位置。

这会导致一个根本性冲突：

- `backend prisma generate` 会覆盖 `quantify` 的 Prisma client
- `quantify prisma generate` 也会覆盖 `backend` 的 Prisma client
- 任一侧 build / test / IDE 类型检查都可能读到另一侧 schema 的类型
- 这与 `quantify` 作为独立微服务、`backend` 通过 HTTP 调用它的架构边界相矛盾

现状证据：

- 两边的 `base.prisma` 都只声明了默认 `generator client { provider = "prisma-client-js" }`
- 两边源码大量直接 `import ... from '@prisma/client'`
- 当前已经出现过：
  - `quantify build` 读到 `backend` 的 Prisma client，导致缺失 `ExchangeAccount`、`IndicatorType` 等类型
  - `backend build` 读到 `quantify` 的 Prisma client，导致缺失 `VerificationCodePurpose`、`WhaleNotificationRuleType` 等类型

## 目标

- `backend` 与 `quantify` 各自拥有独立 Prisma client 输出目录
- 两边构建、测试、启动不再互相覆盖 Prisma 产物
- 两边业务代码不再直接依赖共享 `@prisma/client`
- 服务边界收敛为：
  - 数据库边界独立
  - Prisma client 独立
  - 服务间交互仅保留 HTTP / contract

## 非目标

- 不修改数据库 schema 语义
- 不变更数据库连接串策略
- 不实现 `backend -> quantify` HTTP client
- 不重构业务逻辑
- 不把 Prisma client 抽成共享 package

## 方案对比

### 方案 1：双服务独立 Prisma client 输出目录

做法：

- `backend` Prisma client 输出到独立目录，例如 `apps/backend/generated/prisma`
- `quantify` Prisma client 输出到独立目录，例如 `apps/quantify/generated/prisma`
- 两边源码各自只从自己的 Prisma 入口层导入类型与 client

优点：

- 最符合微服务边界
- 从根上消除互相覆盖
- CI / 本地 / IDE 类型检查都稳定

代价：

- 需要批量替换 import
- 两边各自维护一层 Prisma 入口

结论：推荐。

### 方案 2：只给 quantify 切独立 Prisma client

做法：

- `quantify` 切本地独立 client
- `backend` 继续使用共享 `@prisma/client`

优点：

- 改动较小

缺点：

- 仍保留一套共享默认 Prisma client
- 长期边界不干净

结论：仅适合作为临时过渡，不推荐。

### 方案 3：继续共享 `@prisma/client`，只靠 generate 顺序保证正确

做法：

- 保持当前生成方式
- 加强 build / start 前置 `prisma generate`

优点：

- 短期改动最少

缺点：

- 根因未解
- IDE、并发 CI、交叉构建仍然会串

结论：不接受。

## 推荐方案

采用方案 1：双服务独立 Prisma client 输出目录。

## 设计

### 1. 输出目录

固定输出位置：

- `backend` -> `apps/backend/generated/prisma`
- `quantify` -> `apps/quantify/generated/prisma`

约束：

- 两边不得再写入默认共享 `@prisma/client` 产物作为运行时依赖
- 每个服务只能消费自己的生成目录
- 生成目录纳入 `.gitignore`，不提交产物

### 2. 服务内 Prisma 入口

每个服务保留一层本地 Prisma 入口，用于统一转发类型与 client：

- `apps/backend/src/prisma/prisma.types.ts`
- `apps/quantify/src/prisma/prisma.types.ts`

职责：

- 统一导出该服务自己的 Prisma types / enums / Prisma namespace / PrismaClient
- 作为业务代码唯一可依赖入口

约束：

- `apps/backend/src/**` 禁止直接从 `@prisma/client` 导入
- `apps/quantify/src/**` 也禁止直接从 `@prisma/client` 导入

### 3. 生成配置

两边各自在自己的 `base.prisma` 中声明独立 `output`：

- `apps/backend/prisma/schema/base.prisma`
- `apps/quantify/prisma/schema/base.prisma`

Prisma 7 config (`prisma.config.ts`) 保持：

- 独立 schema 目录
- 独立 datasource URL
- 独立 seed 流程

不做的事：

- 不共用一个 generator output
- 不把一侧 schema 混入另一侧 generate

### 4. import 替换策略

替换顺序固定：

1. 先替换 `quantify`
2. 再替换 `backend`

原因：

- `quantify` 当前问题更直接，且更符合独立微服务边界
- 先让 `quantify` 独立稳定，再处理 `backend`

替换规则：

- 类型导入、枚举导入、`Prisma` namespace、`PrismaClient` 均改走服务内 prisma 入口
- 测试文件与 e2e 文件同样跟随替换

### 5. 构建与命令契约

每个服务的构建必须显式依赖自己的 `prisma:generate`：

- `backend build` 依赖 `backend prisma:generate`
- `quantify build` 依赖 `quantify prisma:generate`

验收原则：

- 任意顺序执行 `backend prisma:generate` / `quantify prisma:generate`，双方 build 都必须稳定
- 不允许出现“最后谁 generate，谁就能 build”的偶然成功

### 6. 边界定义

本设计落地后，边界应明确为：

- `backend` 拥有自己的 schema、Prisma client、数据库连接
- `quantify` 拥有自己的 schema、Prisma client、数据库连接
- `backend` 调 `quantify` 只能通过 HTTP / OpenAPI / contract
- 任何一侧都不通过 Prisma 类型共享另一侧数据库模型

## 实施顺序

### 里程碑 1：输出隔离

- 为 `backend` 和 `quantify` 配置独立 Prisma output
- 更新 `.gitignore` 忽略生成目录

验收：

- 两边 `prisma generate` 后产物互不覆盖

### 里程碑 2：本地入口收口

- 改造 `backend` 的 `prisma.types.ts`
- 新增 `quantify` 的 `prisma.types.ts`

验收：

- 两边都具备本地 Prisma 导出入口

### 里程碑 3：批量替换 import

- 先替换 `quantify`
- 再替换 `backend`

验收：

- 两边源码不再直接依赖 `@prisma/client`

### 里程碑 4：验证

- `pnpm --filter @net/backend run build`
- `pnpm exec dx build quantify --dev`
- `pnpm exec dx start quantify --dev`
- `pnpm exec dx start all`

验收：

- 两边可分别 build
- `quantify` 可独立启动
- 多服务共存时不再出现 Prisma client 串库

## 风险与控制

风险：

- import 替换面较大
- 某些测试或脚本仍隐式依赖 `@prisma/client`

控制：

- 分服务分批替换
- 每替换一侧立即单独 build
- 用 grep 检查残留直接导入
- 用契约测试锁住 build 依赖 generate

## 验收标准

满足以下条件才算完成：

- `backend` 与 `quantify` 各自生成独立 Prisma client
- 两边源码都不再直接依赖共享 `@prisma/client`
- 两边 build 可在任意 generate 顺序下稳定通过
- `quantify` 可运行，`backend` 可运行
- `backend` 与 `quantify` 共存时不再互相污染 Prisma 类型
