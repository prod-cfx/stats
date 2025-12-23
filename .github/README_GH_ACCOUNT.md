# GitHub 账号配置说明

## 概述

本项目支持在 `.env.development.local` 中配置默认的 GitHub 账号，用于 Git 提交和 GitHub CLI 操作。

**重要**：账号信息存储在 `.env.development.local` 中（不会被提交到 Git），与其他敏感配置保持一致。

## 快速开始

### 1. 配置 GitHub 账号

在 `.env.development.local` 文件中添加：

```bash
GH_ACCOUNT=your-github-username
```

**方法一：手动编辑**

```bash
vim .env.development.local
```

添加以下行：

```bash
# GitHub 账号配置
GH_ACCOUNT=your-github-username
```

**方法二：命令行追加**

```bash
echo "GH_ACCOUNT=your-github-username" >> .env.development.local
```

### 2. 验证配置

运行自动检测脚本：

```bash
./scripts/ensure-gh-account.sh
```

## 使用方法

### 日常开发

**提交代码前**，建议先确保账号正确：

```bash
./scripts/ensure-gh-account.sh
```

然后正常使用 Git：

```bash
git add .
git commit -m "feat: xxx"
git push
```

### GitHub CLI 操作

在执行 Issue、PR 等操作前：

```bash
# 确保使用正确的账号
./scripts/ensure-gh-account.sh

# 然后执行 gh 命令
gh issue create --title "xxx"
gh pr create --title "xxx"
```

### 切换账号

**临时切换**（仅本次，不修改配置文件）：

```bash
./scripts/ensure-gh-account.sh another-username
```

**永久切换**（修改配置文件）：

```bash
# 编辑 .env.development.local，修改 GH_ACCOUNT 值
vim .env.development.local
```

## 配置文件说明

### `.env.example`

包含 `GH_ACCOUNT` 的示例配置：

```bash
# GitHub 账号配置（用于 git 提交和 gh CLI 操作）
GH_ACCOUNT=__SET_IN_env.local__
```

### `.env.development.local`

实际的配置文件（不会被提交），示例：

```bash
# GitHub 账号配置
GH_ACCOUNT=aleshiagerwe7984621
```

### `scripts/ensure-gh-account.sh`

自动检测和切换账号的脚本，支持：
- 从 `.env.development.local` 读取配置
- 命令行参数临时切换
- 自动验证和切换账号

## 验证配置

### 查看环境变量

```bash
# 查看 GH_ACCOUNT 配置
grep "^GH_ACCOUNT=" .env.development.local
```

### 查看 GitHub CLI 账号

```bash
# 当前活跃账号
gh api user | jq -r '.login'

# 所有已登录账号
gh auth status
```

### 查看 Git 配置

```bash
# 项目级别配置
git config --local user.name
git config --local user.email
```

## 工作原理

1. **账号读取优先级**：
   - 命令行参数（最高优先级）
   - `.env.development.local` 中的 `GH_ACCOUNT`
   - 未配置时显示友好提示

2. **自动切换**：
   - 检测当前 gh CLI 账号
   - 如果与配置不符，自动执行 `gh auth switch`
   - 切换后再次验证确保成功

3. **统一管理**：
   - 与其他敏感配置（数据库、Redis、JWT 等）存放在同一文件
   - 遵循项目统一的环境变量管理规范

## 故障排除

### 配置未生效

```bash
# 检查配置是否存在
grep "^GH_ACCOUNT=" .env.development.local

# 如果不存在，添加配置
echo "GH_ACCOUNT=your-github-username" >> .env.development.local
```

### gh CLI 无法切换账号

```bash
# 查看已登录的账号
gh auth status

# 手动切换
gh auth switch

# 如果账号未登录，先登录
gh auth login
```

### Git 提交使用了错误的用户名

```bash
# 手动设置项目级别配置
git config user.name "your-github-username"
git config user.email "your-email@example.com"
```

### 权限问题

确保你的账号有权限访问仓库：

```bash
# 验证仓库访问权限
gh repo view owner/repo

# 如果失败，检查账号是否正确
gh api user | jq -r '.login'
```

## 注意事项

1. **隐私保护**：`.env.development.local` 不会被提交，账号信息保持私密
2. **团队协作**：每个成员维护自己的 `.env.development.local` 文件
3. **统一规范**：与项目其他敏感配置保持一致的管理方式
4. **不影响全局**：项目级别配置仅对当前项目生效

## 高级用法

### 多账号管理

如果你有多个账号需要切换：

```bash
# 临时使用账号 A（不修改配置文件）
./scripts/ensure-gh-account.sh account-a

# 临时使用账号 B
./scripts/ensure-gh-account.sh account-b

# 恢复使用配置文件中的账号
./scripts/ensure-gh-account.sh
```

### CI/CD 集成

在 CI 环境中，可以通过环境变量传递：

```bash
export GH_ACCOUNT="ci-bot-account"
./scripts/ensure-gh-account.sh "${GH_ACCOUNT}"
```

### 自动化配置

添加到你的开发工作流：

```bash
# .bashrc 或 .zshrc
alias gh-sync='cd /path/to/project && ./scripts/ensure-gh-account.sh'
```

## 示例

### 完整配置示例

`.env.development.local` 文件内容：

```bash
# 数据库敏感凭证
POSTGRES_HOST=localhost
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_PORT=5432
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${POSTGRES_HOST}:${POSTGRES_PORT}/net_dev

# Redis 凭证
REDIS_HOST=localhost
REDIS_PASSWORD=redis
REDIS_PORT=6379
REDIS_DB=7
REDIS_URL=redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}

# JWT/应用密钥
JWT_SECRET=dev_jwt_secret_not_for_production
APP_SECRET=dev_app_secret_not_for_production

# GitHub 账号配置
GH_ACCOUNT=your-github-username
```

### 使用流程示例

```bash
# 1. 首次设置
echo "GH_ACCOUNT=aleshiagerwe7984621" >> .env.development.local

# 2. 开始开发前检查
./scripts/ensure-gh-account.sh
# 输出：✅ 当前使用正确的账号: aleshiagerwe7984621

# 3. 正常开发
git add .
git commit -m "feat: add new feature"
git push

# 4. 创建 PR
gh pr create --title "feat: add new feature"
```
