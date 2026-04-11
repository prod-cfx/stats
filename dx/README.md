# stats dx 配置说明

这个目录是 `stats` 项目的 `dx` 配置根目录。

它的作用有两层：

1. 定义 `dx/config/*` 的项目级命令树
2. 作为团队内可直接参考的严格新规范示例

这份配置已经按当前最新 `dx` 规范整理过：

- 只使用 strict 环境键
- 不保留旧兼容写法
- `help` 由 `commands.json` 动态生成
- 配置写错时直接报错，不做自动回退

## 目录结构

```text
dx/
├── config/
│   ├── commands.json
│   ├── env-layers.json
│   └── env-policy.jsonc
├── deploy/
│   ├── ecosystem.backend.config.cjs
│   └── ecosystem.quantify.config.cjs
└── README.md
```

这几部分分别负责：

- [commands.json](config/commands.json)
  定义命令树、执行方式、帮助信息
- [env-layers.json](config/env-layers.json)
  定义每个环境加载哪些 `.env` 文件
- [env-policy.jsonc](config/env-policy.jsonc)
  定义环境变量治理规则
- [ecosystem.backend.config.cjs](deploy/ecosystem.backend.config.cjs)
  backend 远端 PM2 配置
- [ecosystem.quantify.config.cjs](deploy/ecosystem.quantify.config.cjs)
  quantify 远端 PM2 配置

## 当前采用的 strict 规范

### 环境键

配置文件中只使用：

- `development`
- `staging`
- `production`
- `test`
- `e2e`

不要写：

- `dev`
- `prod`

### CLI 环境标志

命令行统一使用：

- `--dev`
- `--staging`
- `--prod`
- `--test`
- `--e2e`

### 不再保留的旧写法

以下写法都不应该再出现：

- `--development`
- `--production`
- `--stage`
- 顶层 `dev` 命令树
- `stack-front` / `stack-admin` / `stack-telegram` 这类兼容别名
- 任何“旧配置回退到新配置”或“新配置回退到旧配置”的行为

## `commands.json` 怎么看

[commands.json](config/commands.json) 是核心文件。

这里同时放两类内容：

1. 命令执行配置
2. 帮助信息配置

### 1. 命令执行配置

例如：

```json
{
  "start": {
    "backend": {
      "development": {
        "command": "npx nx dev backend",
        "app": "backend"
      },
      "production": {
        "command": "npx nx start backend",
        "app": "backend"
      }
    }
  }
}
```

表示：

- `dx start backend --dev` 走 `start.backend.development`
- `dx start backend --prod` 走 `start.backend.production`

### 2. 帮助信息配置

例如：

```json
{
  "help": {
    "summary": "stats dx 配置",
    "commands": {
      "start": {
        "summary": "启动服务或开发套件"
      }
    }
  }
}
```

表示：

- `dx --help`
- `dx help start`

这些帮助输出由配置动态渲染，不再依赖代码中的硬编码长文案。

## 这个项目里的主要命令分组

### `start`

启动相关目标包括：

- `backend`
- `quantify`
- `front`
- `admin`
- `development`
- `stack`
- `stagewise-front`
- `stagewise-admin`
- `mock`

其中：

- `start.development` 是默认开发套件
- `start.stack` 是 PM2 交互式服务栈
- `stagewise-front` / `stagewise-admin` 是桥接目标
- `mock` 是前端 mock 后端启动方式

推荐命令：

```bash
dx start
dx start backend --dev
dx start front --dev
dx start stack
```

### `build`

构建目标包括：

- `backend`
- `quantify`
- `shared`
- `front`
- `admin`
- `all`
- `parallelWeb`
- `contracts`
- `affected`

推荐命令：

```bash
dx build backend --prod
dx build quantify --prod
dx build all --dev
```

### `db`

数据库目标包括：

- `generate`
- `migrate`
- `deploy`
- `reset`
- `seed`
- `format`
- `script`

这里还包含 `quantify` 的独立数据库命令分支。

推荐命令：

```bash
dx db migrate --dev --name init-stats-table
dx db deploy --prod
dx db script <script-name> --dev
```

### `deploy`

部署目标分两类：

1. 后端制品部署
   - `backend`
   - `quantify`
2. 前端 Vercel 部署
   - `front`
   - `admin`
   - `all`

推荐命令：

```bash
dx deploy backend --staging
dx deploy quantify --prod
dx deploy front --prod
dx deploy admin --staging
```

## 默认开发套件

当前配置里显式保留了：

```json
"start": {
  "development": {
    "internal": "start-dev"
  }
}
```

所以：

- `dx start`

都会走默认开发套件。

这不是兼容回退，而是当前命令树里明确配置出来的入口。

## `env-layers.json` 怎么看

[env-layers.json](config/env-layers.json) 定义每个环境加载哪些 `.env` 文件。

当前项目是：

```json
{
  "development": [".env.development", ".env.development.local"],
  "staging": [".env.staging", ".env.staging.local"],
  "production": [".env.production", ".env.production.local"],
  "test": [".env.test", ".env.test.local"],
  "e2e": [".env.e2e", ".env.e2e.local"]
}
```

## `env-policy.jsonc` 怎么看

[env-policy.jsonc](config/env-policy.jsonc) 负责环境变量治理。

重点看：

- `environments`
- `keys.secret`
- `appToTarget`
- `targets.*.required`

这里特别值得注意的是：

- `backend`
- `quantify`
- `frontend`

是分开的 target，`quantify` 使用独立变量前缀，例如：

- `QUANTIFY_DATABASE_URL`
- `QUANTIFY_REDIS_URL`
- `QUANTIFY_JWT_SECRET`

## 部署架构

这个项目当前有两类部署目标：

| 目标 | 部署方式 | 命令 |
|------|---------|------|
| `backend` | `backend-artifact-deploy` → SSH → PM2 | `dx deploy backend --staging/--prod` |
| `quantify` | `backend-artifact-deploy` → SSH → PM2 | `dx deploy quantify --staging/--prod` |
| `front` | Vercel CLI | `dx deploy front --staging/--prod` |
| `admin` | Vercel CLI | `dx deploy admin --staging/--prod` |

## 后端制品部署说明

`backend` 和 `quantify` 都使用内置的 `backend-artifact-deploy` 流程。

流程大致是：

1. 本地构建
2. 打包制品
3. SSH 上传
4. 远端安装依赖
5. Prisma generate / migrate deploy
6. PM2 启动
7. 保留最近 release

相关配置在：

- [ecosystem.backend.config.cjs](deploy/ecosystem.backend.config.cjs)
- [ecosystem.quantify.config.cjs](deploy/ecosystem.quantify.config.cjs)

## 前端部署说明

`front` 和 `admin` 走 Vercel CLI。

相关命令在 [commands.json](config/commands.json) 的 `deploy.front` / `deploy.admin` 中定义。

## 给同事的结论

如果你要继续维护这套 `dx` 配置，直接遵守这几条：

- 配置里的环境键只写完整名
- 命令行只用短环境标志
- 所有帮助说明都写在 `commands.json` 的 `help` 区域
- 不要再加任何旧兼容入口
- 配错了就让 `dx` 直接报错，然后改配置
