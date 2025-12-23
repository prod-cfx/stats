# Git 与 GitHub 规范

## 一、Git 与 Issue 强制规则

### 1.1 Issue ID 必需

- 🔗 **Issue ID 必需**：提交前必须有 Issue ID；若无则询问用户创建或指定

### 1.2 Issue 分支强制

- 🚨 **Issue 分支强制**：修改代码前必须检查当前分支
  - ✅ 允许：在 `feat/<issue-id>-*`、`fix/<issue-id>-*`、`refactor/<issue-id>-*` 等 issue 分支上修改
  - ❌ 禁止：在 `main`、`master` 等主分支上修改代码
  - 📋 处理流程：
    1. 检测到需要修改代码时，先执行 `git branch --show-current` 检查当前分支
    2. 如果在主分支，询问用户提供 Issue ID 或使用 `/git-create-issue` 创建
    3. 获取 Issue ID 后，创建对应分支：`git checkout -b <type>/<issue-id>-<description>`
    4. 切换到 issue 分支后再执行代码修改
    5. 如果用户拒绝创建分支，则拒绝修改代码并说明原因

### 1.3 Git 认证与格式

- 📝 **Heredoc 格式**：Git 提交与 GitHub CLI 必须使用 heredoc（见下文）
- 🚫 **禁止 `\n` 换行**：在命令参数中写 `\n` 只会产生字面量，不会换行
- 📌 **推送后评论**：推送后必须在对应 Issue 评论报告修改并关联 commit hash
- 🔑 **统一 SSH 认证**：Git 远程和 GitHub CLI 操作统一使用 SSH key 认证
- ❗ **GitHub CLI 账号切换**：如 `gh` 命令提示权限不足或访问被拒绝，先执行 `gh auth status` 查看当前账号，如需切换使用 `gh auth switch`，或通过 `gh auth login` 重新登录；不要使用不存在的 `gh switch user` 命令

---

## 二、提交格式

- 使用 Conventional Commits：`feat:`/`fix:`/`docs:`/`refactor:` 等
- 末尾添加：`Refs: #123` 或 `Closes: #123`

---

## 三、Heredoc 使用（强制）

### 3.1 Git 提交

```bash
git commit -F - <<'MSG'
feat: 功能摘要

变更说明：
- 具体变更点1
- 具体变更点2

Refs: #123
MSG
```

### 3.2 GitHub CLI - PR 创建

```bash
gh pr create --body-file - <<'MSG'
## 变更说明
- 具体变更点1
- 具体变更点2

close: #123
MSG
```

### 3.3 GitHub CLI - Issue 评论

```bash
gh issue comment 123 --body-file - <<'MSG'
问题分析：
- 原因1
- 原因2
MSG
```

### 3.4 GitHub CLI - PR Review

```bash
gh pr review 123 --comment --body-file - <<'MSG'
代码审查意见：
- 建议1
- 建议2
MSG
```

---

## 四、提交前质量检查

### 4.1 增量预检流程

**执行时机**：提交前必须执行（所有分支）

**跳过条件**（同时满足才可跳过）：

- 本次会话已完成一次增量预检
- 自上次预检后，仅修改了以下类型文件：
  - 文档文件（`*.md`）
  - 注释（单纯的注释修改，无代码变更）
  - `.gitignore`、`LICENSE` 等非代码文件

**必须执行**（任一条件满足）：

- 本次会话未完成增量预检
- 修改了任何代码文件（`.ts`、`.tsx`、`.js`、`.jsx` 等）
- 修改了配置文件（`package.json`、`tsconfig.json`、`.env.*` 等）
- 修改了样式文件（`.css`、`.scss` 等）

**执行内容**：

1. `./scripts/dx lint` —— 所有关联代码改动必跑；**如发现任何 lint 问题，必须先执行一次 `./scripts/dx lint --fix`，再重新运行 `./scripts/dx lint`，只有在自动修复后仍有残留错误时，才允许手动修改代码**
2. `./scripts/dx build backend` —— 仅在后端代码或共享逻辑被后端使用时执行
3. `./scripts/dx build front` —— 仅在用户端前端代码有改动时执行
4. `./scripts/dx build admin` —— 仅在管理后台代码有改动时执行

**失败处理**：

- 任一命令失败则终止，不允许提交
- 修复问题后需重新执行失败的命令（以及后续受影响的命令）

**CI 提示**：

- CI 环境仍通过 `./scripts/dx prcheck --prod` 执行同一套检查，本地无需额外跑全量命令


## 五、推送后流程

1. 推送代码到远端
2. 在对应 Issue 评论报告修改内容
3. 关联提交 hash

---

## 六、关键约束

- 提交前必须确认存在 Issue ID（无则询问用户）
- 统一使用 SSH key 认证（Git 和 gh CLI）
- 禁止使用 `\n` 字符（只会产生字面量）
- 增量预检：已执行且仅改文档/注释可跳过，涉及代码改动必须重新执行
