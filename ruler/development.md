# 开发流程与命令系统

## 一、构建与校验约束

### 1.1 构建策略

- 🔨 **构建策略**：按应用分别构建（backend/front/admin），本地禁止 `./scripts/dx build all`；CI 使用 `./scripts/dx build all --prod`
- 🔍 **增量预检**：提交前必须执行 `./scripts/dx lint`；若后端代码有改动需先运行 `./scripts/dx build backend`，随后仅在后端 DTO 或 API 变更时执行 `./scripts/dx build contracts`，最后再按需运行 `./scripts/dx build front` 与 `./scripts/dx build admin`；CI 仍由 `./scripts/dx prcheck --prod` 负责全量校验
- 🚫 **提交前构建**：提交前必须对受影响应用执行构建并通过；构建失败禁止提交

### 1.2 测试与提交流程

- 🧪 **E2E 测试规则**：详见 conventions.md「测试约定」
- 📋 **提交前检查清单**（四步走）：
  1. 识别受影响 E2E 用例并逐个运行通过（后端改动时）
  2. 分别构建受影响应用（backend/front/admin）
  3. 执行增量预检（`./scripts/dx lint` 必跑；若后端代码改动先跑 `./scripts/dx build backend`，再视 DTO/API 变更决定是否执行 `./scripts/dx build contracts`，最后按需运行前端与管理后台构建）
  4. 若增量预检包含 `./scripts/dx build contracts`，仅需确认 SDK 构建成功；`packages/api-contracts/openapi/backend.json` 视为本地构建产物，**不再纳入 Git 管理，也无需手动检查/提交**

### 1.3 Lint 自动修复策略

- **入口命令**：统一使用 `./scripts/dx lint` 进行检查；如需自动修复，使用 `./scripts/dx lint --fix`
- **强制流程**（请严格遵守顺序）：
  - 第一步：运行 `./scripts/dx lint`
  - 如果 lint **没有报错**，可以继续后续流程
  - 如果 lint **有报错**，第二步必须执行：

```bash
./scripts/dx lint --fix
```

  - 第三步：再次运行 `./scripts/dx lint`，若此时仍有错误，才允许在代码中进行手动修改并重复上述流程，直到 `./scripts/dx lint` 通过

---

## 二、命令系统

### 2.1 核心规则

> 详细约束见 conventions.md「输出与命令约束」

- **环境标志**：`--dev/--staging/--prod/--test/--e2e`（禁止位置参数）

### 2.2 常用命令速查

| 类别         | 命令                                          | 说明                                             |
| ------------ | --------------------------------------------- | ------------------------------------------------ |
| **启动服务** | `./scripts/dx start backend --dev`            | 启动后端（端口 3000）                            |
|              | `./scripts/dx start front --dev`              | 启动前端（端口 3001）                            |
|              | `./scripts/dx start admin --dev`              | 启动管理后台（端口 3500）                        |
|              | `./scripts/dx start all`                      | 同时启动所有服务（默认 dev）                     |
| **数据库**   | `./scripts/dx db generate`                    | 生成 Prisma Client                               |
|              | `./scripts/dx db format`                      | 格式化 schema                                    |
|              | `./scripts/dx db migrate --dev --name <名称>` | 创建开发迁移（开发环境必须指定 --name）          |
|              | `./scripts/dx db deploy --dev\|--prod`        | 应用迁移（本地/预发/生产；生产需确认）           |
|              | `./scripts/dx db reset --dev`                 | 重置数据库（危险）                               |
|              | `./scripts/dx db seed --dev`                  | 填充种子数据                                     |
| **构建**     | `./scripts/dx build backend --dev\|--prod`    | 构建后端                                         |
|              | `./scripts/dx build front --dev\|--prod`      | 构建前端                                         |
|              | `./scripts/dx build admin --dev\|--prod`      | 构建管理后台                                     |
|              | ⚠️ 本地禁止：`./scripts/dx build all`         | 仅 CI 用 `--prod`                                |
| **PR 预检**  | `./scripts/dx lint`                           | 所有代码改动必跑                                 |
|              | `./scripts/dx build backend`                  | 修改后端相关代码时执行                           |
|              | `./scripts/dx build contracts`                      | 仅后端 DTO/API 变更时执行（输出到 `packages/api-contracts`，应紧随 backend 之后） |
|              | `./scripts/dx build front`                    | 修改用户端前端代码时执行                         |
|              | `./scripts/dx build admin`                    | 修改管理后台代码时执行                           |
| **CI**       | `./scripts/dx prcheck --prod`                 | CI 专用全量校验                                  |
| **测试**     | `./scripts/dx test e2e backend <file>`        | 运行 E2E（逐个运行）                             |
|              | `./scripts/dx lint`                           | 代码检查和格式化                                 |
| **SDK**      | `./scripts/dx build contracts`                      | 生成并构建 SDK                                   |
| **生产**     | `./scripts/dx build backend --prod`           | 生产构建                                         |
|              | `./scripts/dx db deploy --prod`               | 生产迁移                                         |
|              | `./scripts/dx start backend --prod`           | 生产启动                                         |

---

## 三、前端日志配置

### 3.1 日志级别说明

前端日志系统支持以下级别（按严重程度从低到高）：

- **SILLY** → 最详细的调试信息
- **TRACE** → 跟踪信息
- **DEBUG** → 调试信息（开发环境默认）
- **INFO** → 一般信息
- **WARN** → 警告信息（生产环境默认）
- **ERROR** → 错误信息
- **FATAL** → 致命错误

### 3.2 环境变量配置

#### 方式 1：构建时环境变量（推荐）

**文件**：`.env.[environment].local`

```bash
# 前端日志级别
NEXT_PUBLIC_LOG_LEVEL=WARN  # 可选: SILLY | TRACE | DEBUG | INFO | WARN | ERROR | FATAL
```

**特点**：
- ✅ 在构建时生效，影响 SSR 和客户端初始日志级别
- ✅ 适用于持久配置
- ✅ 构建脚本会自动验证配置合法性

**示例**：

```bash
# 开发环境（默认 DEBUG，通常无需设置）
NEXT_PUBLIC_LOG_LEVEL=DEBUG

# 生产环境（默认 WARN）
NEXT_PUBLIC_LOG_LEVEL=WARN

# 预发布环境（建议 INFO）
NEXT_PUBLIC_LOG_LEVEL=INFO

# 生产环境临时调试（谨慎使用）
NEXT_PUBLIC_LOG_LEVEL=DEBUG
```

#### 方式 2：运行时 localStorage（临时调试）

**浏览器控制台**：

```javascript
// 临时开启 DEBUG 日志
localStorage.setItem('logLevel', 'DEBUG')
location.reload()

// 恢复默认级别
localStorage.removeItem('logLevel')
location.reload()
```

**特点**：
- ✅ 无需重新构建，立即生效
- ✅ 适用于用户端临时排查问题
- ⚠️ 仅影响当前浏览器

### 3.3 优先级规则

日志级别的优先级（从高到低）：

1. **运行时 localStorage** → `localStorage.logLevel`
2. **构建期环境变量** → `NEXT_PUBLIC_LOG_LEVEL` / `VITE_LOG_LEVEL`
3. **环境默认值** → 开发 `DEBUG` / 生产 `WARN`

### 3.4 实际应用场景

#### 场景 1：生产环境排查问题

用户报错时，可以指导用户：

```javascript
// 在浏览器控制台执行
localStorage.setItem('logLevel', 'DEBUG')
location.reload()

// 复现问题后，右键 "Save as..." 保存完整控制台日志
```

#### 场景 2：预发布环境监控

```bash
# .env.staging.local
NEXT_PUBLIC_LOG_LEVEL=INFO  # 比生产多输出 INFO，但不包含 DEBUG 噪音
```

#### 场景 3：CI/CD 构建验证

```bash
# 错误的配置会导致构建失败
NEXT_PUBLIC_LOG_LEVEL=INVALID ./scripts/dx build front
# 输出: 错误: NEXT_PUBLIC_LOG_LEVEL 必须是以下之一: SILLY | TRACE | DEBUG | INFO | WARN | ERROR | FATAL
```

### 3.5 最佳实践

**生产环境**：
- ✅ 使用默认 `WARN` 级别
- ✅ 保留 error/warn 日志，方便用户反馈时提供截图
- ❌ 避免长期开启 `DEBUG`（会产生大量日志）

**开发环境**：
- ✅ 使用默认 `DEBUG` 级别
- ✅ 充分利用日志排查问题

**用户端调试**：
- ✅ 通过 localStorage 临时开启 DEBUG
- ✅ 截图后及时关闭，避免影响性能

### 3.6 注意事项

1. **环境变量命名**：
   - Next.js 项目使用 `NEXT_PUBLIC_LOG_LEVEL`
   - Vite 项目使用 `VITE_LOG_LEVEL`

2. **SSR 与客户端一致性**：
   - 环境变量在 SSR 阶段和客户端初始化时生效
   - localStorage 仅在客户端运行时生效（避免 SSR 不一致）

3. **性能影响**：
   - `WARN` 及以上级别性能影响极小
   - `DEBUG` 级别在高频调用场景可能产生一定开销

---

## 四、工作流程

### 4.1 新功能开发流程

**前置检查（强制）**：

1. **检查当前分支**：执行 `git branch --show-current`
   - 如果在 `main`/`master` 分支，**禁止开始开发**
   - 必须先获取或创建 Issue ID
   - 创建对应的 issue 分支（如 `feat/123-add-feature`）
2. **确认 Issue 存在**：
   - 如果没有 Issue ID，询问用户提供或使用 `/git-create-issue` 创建
   - 记录 Issue ID 供后续提交使用

**开发流程**：

1. 检查 `apps/backend/src/modules/` 现有模块模式
2. 可使用模块生成器辅助搭建
3. 遵循标准文件结构：controller、service、dto、entities
4. 添加 OpenAPI 装饰器以自动生成 SDK
5. 更新/新增 E2E 测试（`apps/backend/e2e/`）
6. 更新相关文档

### 4.2 数据库变更流程

```bash
# 1. 修改 schema
vi apps/backend/prisma/schema/*.prisma

# 2. 格式化
./scripts/dx db format

# 3. 生成客户端
./scripts/dx db generate

# 4. 创建迁移（非交互）
./scripts/dx db migrate --dev --name <migration-name>
```

### 4.3 API 变更 → 前端更新链路

```
后端更新 DTO/Service
  ↓
./scripts/dx db migrate --dev --name <migration-name>
  ↓
Swagger/OpenAPI 自动更新接口描述
  ↓
./scripts/dx build contracts
  ↓
前端更新类型与调用
```

### 4.4 提交前检查清单（强制）

- [ ] 识别受影响的 E2E 用例并逐个运行通过（后端改动时）
- [ ] 按改动执行增量预检（`./scripts/dx lint` 必跑；若需构建，遵循 backend → sdk → front → admin 的顺序，并仅在 DTO/API 变更时运行 `./scripts/dx build contracts`）
- [ ] 若增量预检包含 `./scripts/dx build contracts`，确认 SDK 构建成功；`packages/api-contracts/openapi/backend.json` 为本地生成的 OpenAPI 规范文件，**已从 Git 中移除，无需提交**
- [ ] 确认无 `.env` 违规文件
- [ ] 确认 Issue ID 存在并已关联

**注意**：main 分支提交和 PR 创建时，E2E 测试为强制门禁，必须全部通过

### 4.5 调试工作流

**增量预检建议顺序**

本地自检建议按以下顺序执行命令，只有在对应模块确有改动时才继续后续构建；任一步失败需先修复再重试：

1. `./scripts/dx lint`
2. `./scripts/dx build backend`（仅当修改后端代码或共享逻辑被后端使用）
3. `./scripts/dx start backend`（仅当需要验证后端改动；正常情况下不会返回，最多等待 50 秒）
4. `./scripts/dx build contracts`（仅当后端 DTO/API 有变更）
5. `./scripts/dx build front`（仅当修改用户端前端代码）
6. `./scripts/dx build admin`（仅当修改管理后台代码）

---

## 五、Seed 数据架构 (Issue #1343 架构重构)

### 5.1 架构概览

**设计理念**: 单文件入口 + 显式环境加载 + 幂等 upsert

```text
apps/backend/prisma/
└── seed.ts  # 加载环境变量 → 初始化 Prisma(Driver Adapter) → 执行 seedBaseRoles/seedAdminMenus/seedAdminUser
```

### 5.2 种子内容与幂等策略

| 种子内容 | 说明 | 幂等策略 | 备注 |
|---------|------|---------|------|
| **基础角色** | AppRole 默认角色 | `role.upsert({ where: { code } })` | SUPER_ADMIN 授权全部权限 |
| **后台菜单** | AdminMenu 菜单树 | `adminMenu.upsert({ where: { code } })` | 内存 Map 解析父子关系 |
| **管理员账号** | 超级管理员账户 | 先 `findUnique`，缺失才 `create` | `SEED_ADMIN_*` 可覆盖默认值 |

### 5.3 环境策略

| 环境 | 是否执行 | 说明 |
|------|----------|------|
| **Development** | ✅ 运行 | 与其他环境一致 |
| **Staging** | ✅ 运行 | 与其他环境一致 |
| **Production** | ✅ 运行 | 建议通过 `SEED_ADMIN_*` 覆盖默认账号 |
| **E2E** | ✅ 运行 | 与其他环境一致 |

### 5.3.1 账号参数规范

🔒 **管理员种子参数**：

1. `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_EMAIL` 可覆盖默认值（默认 `admin` / `admin123` / `admin@example.com`）
2. 生产环境必须通过环境变量注入强密码
3. 禁止在代码中硬编码生产账号信息

### 5.4 幂等性说明

- 角色与菜单使用 upsert，重复运行不会产生重复记录，会同步到代码定义
- 管理员账号仅在不存在时创建，不会覆盖已存在的密码与邮箱
- SUPER_ADMIN 角色绑定缺失时会补齐

### 5.5 使用指南

#### 添加新的种子步骤

1. 在 `apps/backend/prisma/seed.ts` 新增 seed 函数，保持幂等（优先 `upsert` 或 `findUnique` + `create`）
2. 在 `main()` 中按顺序调用新的 seed 函数
3. 需要环境变量时使用 `createEnvAccessor()` 读取并在 `.env.*.local` 配置

### 5.6 故障排查

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| `DATABASE_URL` 未配置或仍为占位符 | `.env.*.local` 未设置或值无效 | 设置正确的 `DATABASE_URL` 后重试 |
| 连接失败/超时 | 数据库不可用或连接串错误 | 检查数据库服务与连接字符串 |
| 管理员账号未更新 | 已存在账号不会被覆盖 | 手动更新/删除账号，或调整 seed 逻辑 |

---

## 六、故障排除

| 问题         | 解决方案                        |
| ------------ | ------------------------------- |
| SDK 生成失败 | 确认后端正在运行                |
| 类型错误     | 运行 `./scripts/dx db generate` |
| 端口占用     | 启动脚本自动清理                |
