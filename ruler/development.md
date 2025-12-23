# 开发流程与命令系统

## 一、构建与校验约束

### 1.1 构建策略

- 🔨 **分项目构建**：本地优先执行 `./scripts/dx build backend|front|admin --dev`；CI 通过 `./scripts/dx build all --prod`（禁止本地运行）。
- 🔍 **增量预检**：提交前至少执行一次 `./scripts/dx lint`。若改动后端，再跑 `./scripts/dx build backend`；若改动任一 Next 应用，再跑对应构建。CI 由 `./scripts/dx prcheck --prod` 全量兜底。
- ⛔ **禁用包管理器**：**绝对禁止**使用 `pnpm`、`npm`、`yarn`、`npx` 命令，所有操作必须通过 `./scripts/dx` 执行。
- 🚫 **失败即止**：任一构建或 lint 失败必须先修复并重跑；禁止忽略错误继续提交。

### 1.2 测试与提交流程

- 🧪 **E2E 规则**：当前仅维护 `apps/backend/e2e`（Jest）；`./scripts/dx test e2e backend [spec] [-t "case"]` 支持逐文件/逐用例执行。无单元测试。
- 📋 **提交前清单**：
  1. 根据改动范围跑 E2E（至少覆盖受影响 spec）；main 分支与 PR 创建强制全部通过。
  2. 按顺序执行 `./scripts/dx lint` → `./scripts/dx build backend`（若涉及）→ `./scripts/dx build front` / `admin`（若涉及）。
  3. 若修改 DTO/API，务必运行 `./scripts/dx contracts` 并提交 `packages/api-contracts`。
  4. 确认 `.env*` 没有新敏感文件被提交。
  5. 检查 commit message 带 Issue ID（详见 `git-workflow.md`）。

### 1.3 Lint 自动修复

1. 运行 `./scripts/dx lint`。
2. 若有报错，执行 `./scripts/dx lint --fix`，然后再次运行 `./scripts/dx lint`。
3. 只有在自动修复后仍存在问题时，才允许手动修改并重复上述流程。

---

## 二、命令系统

| 类别 | 命令 | 说明 |
| --- | --- | --- |
| **启动服务** | `./scripts/dx start backend --dev` | 启动 Nest 开发服务（3000） |
|  | `./scripts/dx start front --dev` | 启动用户端 Next（3001） |
|  | `./scripts/dx start admin --dev` | 启动管理端 Next（3500） |
|  | `./scripts/dx start all` | 并行启动 backend/front/admin（dev 环境） |
| **数据库** | `./scripts/dx db generate` | 运行 Prisma `generate` |
|  | `./scripts/dx db format` | `schema.prisma` 格式化 |
|  | `./scripts/dx db migrate --dev --name <name>` | 开发迁移（必须提供 `--name` 或位置参数） |
|  | `./scripts/dx deploy --prod`（或 `--staging` / `--test`） | 应用迁移（prisma migrate deploy，无需 `--name`） |
|  | `./scripts/dx db seed --dev` | 执行 `apps/backend/prisma/seed.ts` |
| **构建** | `./scripts/dx build backend --dev|--prod` | Nest 构建（`dist/backend`） |
|  | `./scripts/dx build front --dev|--prod` | Next 构建；生产模式使用 `front:exportDist` |
|  | `./scripts/dx build admin --dev|--prod` | 管理端构建 |
|  | ⚠️ `./scripts/dx build all --prod` | 仅 CI/发布使用，禁止本地运行 |
| **PR 预检** | `./scripts/dx prcheck --prod` | Lint → backend build → contracts → front/admin build |
| **测试** | `./scripts/dx test e2e backend <file> [-t case]` | 指定文件/用例运行 E2E |
|  | `./scripts/dx test e2e backend` | 全量 E2E（耗时，谨慎使用） |
| **合约** | `./scripts/dx contracts` | 导出 Swagger + 生成 `@ai/api-contracts` |
| **缓存/清理** | `./scripts/dx cache clear` | 清理 Nx/PNPM 缓存（危险命令需确认） |

所有命令默认加载 `.env.development(.local)`；传入 `--prod / --staging / --e2e` 时会切换到对应层。

---

## 三、日志与环境开关

### 3.1 后端日志

- `apps/backend/src/config/logger.config.ts` 使用 winston；`LOG_LEVEL` 控制输出（默认 dev=debug、prod=warn），`LOG_CONTEXT_FILTER` 允许逗号分隔的 `Logger` 名称白名单。
- `APP_ENV=e2e/test` 时日志强制静默，仅输出错误，避免污染测试快照。
- `./scripts/dx` 会根据 `scripts/config/required-env.jsonc` 校验 `LOG_LEVEL` 是否存在，推荐值：error、warn、info、debug。

### 3.2 前端环境检查

- `apps/front/scripts/check-env.js` 要求配置 `NEXT_PUBLIC_API_BASE_URL`、`APP_ENV`，并在设置 `NEXT_PUBLIC_LOG_LEVEL` 时校验可选值（SILLY/TRACE/DEBUG/INFO/WARN/ERROR/FATAL）。前端目前仍使用 `console` 级别日志，该变量只是为了未来引入 `tslog` 做预留；建议 dev=DEBUG、prod=WARN。
- `apps/admin-front/scripts/check-env.js` 只校验 `NEXT_PUBLIC_API_BASE_URL` 与 `APP_ENV`。Admin 暂未接入日志级别，可按需在 `.env.*.local` 中手动控制。

### 3.3 配置加载顺序

- `packages/config` 已在 Nest `main.ts` 调用 `loadEnvironment()`；若新建 CLI/Next 服务器入口，必须在做其他操作前调用同函数以保证 zod 校验和 `.env` 层级一致。
- `.env.<env>.local` 冲突时优先生效；`./scripts/dx` 会在命令执行前打印加载顺序，便于排查。

---

## 四、工作流程

### 4.1 新功能开发

1. 检查当前分支（`git branch --show-current`）；禁止在 `main` 直接开发。
2. 绑定 Issue ID（`feat/123-...`），无 Issue 先通过 `git-workflow.md` 中流程创建。
3. 对照现有模块（例如 `apps/backend/src/modules/accounts`）确认目录结构，再按 controller/service/dto/exception 划分。
4. 开发过程中保持 Swagger 注解完整，结束后运行 `./scripts/dx contracts` 确保前端消费的 schema 更新。
5. 更新/新增必要的 E2E（位于同名目录下，例：`apps/backend/e2e/indicators/...`）。

### 4.2 数据库变更

```bash
vi apps/backend/prisma/schema.prisma
./scripts/dx db format
./scripts/dx db generate
./scripts/dx db migrate --dev --name add_strategy_table
```

迁移生成后提交 `apps/backend/prisma/migrations`。CI/预发/生产部署前通过 `./scripts/dx deploy --prod`（或 `--staging`）应用。

### 4.3 API 变更链路

```
后端更新 DTO/Controller
  ↓
./scripts/dx db migrate --dev --name ...（如涉及 schema）
  ↓
./scripts/dx contracts  # 导出 Swagger + 生成 Zod 客户端
  ↓
前端更新 `@ai/api-contracts`（集中在 front/admin 的 `src/lib/api.ts`）
```

> 部署到预发/生产前，务必执行 `./scripts/dx deploy --<env>`（如 `--staging`、`--prod`）来应用最新迁移。

必做事项：提交 `packages/api-contracts/src/generated/backend.ts`、更新调用封装、重新运行 `./scripts/dx lint` + 受影响应用的构建。

### 4.4 调试顺序（推荐）

1. `./scripts/dx lint`
2. `./scripts/dx build backend`
3. `./scripts/dx start backend --dev`（如需验证 API，注意命令不会退出）
4. `./scripts/dx build front`
5. `./scripts/dx build admin`

任一步失败即停止，修复后从失败步骤重新执行。

---

## 五、种子数据与默认账号

### 5.1 入口

- 位置：`apps/backend/prisma/seed.ts`。
- 命令：`./scripts/dx db seed --dev`（同理可传 `--e2e` / `--prod`，生产环境有危险确认）。

### 5.2 功能概览

- `seedBaseRoles()`：向 `roles` 表 upsert `USER/MODERATOR/ADMIN/SUPER_ADMIN`，并为超级管理员授予 `*` 权限。
- `seedAdminMenus()`：若 `admin_menus` 为空则创建“系统设置”目录及 3 个子菜单。
- `seedAdminUser()`：创建默认管理员（用户名/密码在文件顶部常量中配置）并绑定 `SUPER_ADMIN` 角色。
- `seedAiProviderKeys()`：读取 `UNIAPI_API_KEY`，为 `aiProviderKey` upsert `uniapi/default`。

### 5.3 环境依赖

- `UNIAPI_API_KEY`：若为空或仍为 `__SET_IN_env.local__`，AI Provider 将跳过初始化；请在 `.env.<env>.local` 配置真实值。
- `BCRYPT_SALT_ROUNDS`：可覆盖种子用户的密码哈希成本，默认 12。

### 5.4 定制策略

- 需要额外的菜单/角色，可直接扩展 `seedAdminMenus` / `seedBaseRoles` 并保持 `upsert` 幂等。
- 若要创建演示账号或策略模板，请在 `seed.ts` 中新增函数并在 `main()` 序列化调用，确保复跑不会覆盖已编辑的数据（尽量使用 `find` + `create`）。

### 5.5 故障排查

| 现象 | 可能原因 | 处理方式 |
| --- | --- | --- |
| `seed` 停在 `aiProviderKey` | 缺少 `UNIAPI_API_KEY` | 设置变量后重跑 |
| 管理员未生成 | 角色 upsert 失败或数据库已有旧账号 | 删除冲突数据或更新用户名常量后重跑 |
| 菜单重复 | 手动插入/迁移导致 `admin_menus` 非空 | 删除菜单后再执行 seed |

---

## 六、故障排除

| 问题 | 解决方案 |
| --- | --- |
| `./scripts/dx contracts` 失败 | 先运行 `./scripts/dx build backend`，确保 `nx run backend:swagger` 能产出 JSON；确认所有 DTO 都挂载了 Swagger 装饰器。 |
| `nx` 缓存脏数据 | 执行 `./scripts/dx cache clear`（会清空 `.nx/cache` 与依赖缓存，慎用）。 |
| 端口占用 | `./scripts/dx start ...` 会自动尝试释放占用端口；必要时手动结束冲突进程。 |
| Prisma 锁未释放 | `./scripts/dx db migrate` / `./scripts/dx deploy` 若异常终止，可运行 `./scripts/dx db reset --dev` 或手动删除 `prisma_migrations_lock`。 |

---

保持以上流程，可确保 Nx 与 DX CLI 一致工作，避免环境漂移与类型/合约不一致。
