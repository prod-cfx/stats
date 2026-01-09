# Git 与 GitHub 规范

## 一、Git 与 Issue 强制规则

### 1.1 Issue ID 必需

- 🔗 **Issue ID 必需**：提交前必须有 Issue ID；若无则询问用户创建或指定

### 1.2 主分支保护规则

- 🚨 **main/master 分支保护**：
  - ✅ **允许**：在 main 分支修改代码、查看、调试
  - ❌ **禁止**：直接在 main 分支执行 `git commit`
  - ❌ **禁止**：直接 `git push` 到 main 分支（必须通过 PR 合并）

### 1.3 Issue 分支提交规则

- 📋 **提交流程**：
  1. 可以在任意分支（包括 main）进行代码修改
  2. 提交前执行 `git branch --show-current` 检查当前分支
  3. 如果在 main/master 分支：
     - 询问用户提供 Issue ID 或使用 `/git-create-issue` 创建
     - 创建 issue 分支：`git checkout -b <type>/<issue-id>-<description>`
     - 切换后再执行 `git add` 和 `git commit`
  4. 如果用户拒绝创建分支，则拒绝提交并说明原因
- ✅ **允许提交的分支**：`feat/<issue-id>-*`、`fix/<issue-id>-*`、`refactor/<issue-id>-*` 等 issue 分支

### 1.4 Git 认证与格式

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

## 四、推送后流程

1. 推送代码到远端
2. 在对应 Issue 评论报告修改内容
3. 关联提交 hash

---

## 五、关键约束

- 提交前必须确认存在 Issue ID（无则询问用户）
- 统一使用 SSH key 认证（Git 和 gh CLI）
- 禁止使用 `\n` 字符（只会产生字面量）
- 增量预检和构建流程见 development.md
