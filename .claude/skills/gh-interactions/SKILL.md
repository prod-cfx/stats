---
name: gh-interactions
description: GitHub CLI operations for Issue and PR management. Use when needing to read Issue/PR details, comment on discussions, reply to PR review comments (code-level), or manage GitHub workflows. Provides verified command patterns and SSH authentication setup.
---

# GitHub CLI 交互技能

## 目的

提供高效的 GitHub CLI (gh) 操作模式,消除在 Issue/PR 管理中重复探索命令格式、认证方式、heredoc 使用等,避免浪费 token。

## 何时使用

当需要执行以下操作时激活此技能:

- 读取 Issue 或 PR 的详细信息(标题、描述、评论)
- 在 Issue 或 PR 中添加评论
- 读取 PR review comments(代码级评论)
- 回复 PR review comments
- 查看 PR 的 diff 和文件变更
- 创建或管理 PR

## 认证状态

### 验证认证

```bash
# 检查认证状态
gh auth status

# 预期输出:
# ✓ Logged in to github.com account <username>
# - Git operations protocol: ssh
```

### 认证要求

- ✅ 已认证账号(通过 keyring)
- ✅ Git 操作协议: SSH
- ✅ Token 权限: repo, workflow, read:org

## 核心工作流

### 1. Issue 操作

#### 列出 Issues

```bash
# 列出最近的 Issues
gh issue list --limit 10 --json number,title,author,state,createdAt

# 过滤打开的 Issues
gh issue list --state open --limit 20
```

#### 读取 Issue 详情

```bash
# 基础信息
gh issue view <number> --json number,title,body,author,state,createdAt

# 包含评论(限制数量)
gh issue view <number> --json number,title,body,comments --jq '{number,title,body,comments: .comments[:5]}'
```

#### Issue 评论(heredoc 格式)

```bash
gh issue comment <number> --body-file - <<'MSG'
评论内容第一行

详细说明:
- 要点1
- 要点2

结论
MSG
```

### 2. PR 操作

#### 列出 PRs

```bash
# 列出最近的 PRs
gh pr list --limit 10 --json number,title,author,state,createdAt

# 查看我的 PRs
gh pr list --author @me
```

#### 读取 PR 详情

```bash
# 基础信息
gh pr view <number> --json number,title,body,author,state,createdAt

# 包含 reviews 和 comments
gh pr view <number> --json number,title,body,reviews,comments --jq '{number,title,body,reviews: .reviews[:3],comments: .comments[:3]}'
```

#### PR 评论(heredoc 格式)

```bash
gh pr comment <number> --body-file - <<'MSG'
反馈内容

变更建议:
- 建议1
- 建议2
MSG
```

### 3. PR Review Comments (代码级评论)

#### 读取代码级评论

```bash
# 使用 GitHub API 获取 review comments
gh api repos/<owner>/<repo>/pulls/<number>/comments --jq '.[:10] | .[] | {id, path, line, body, user: .user.login}'

# 示例(当前仓库):
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments --jq '.[:5] | .[] | {id, path, position, line, body}'
```

#### 回复代码级评论

```bash
# 回复特定的 review comment
gh api repos/<owner>/<repo>/pulls/<number>/comments -X POST -f body="回复内容" -f in_reply_to=<comment_id>

# 或使用 heredoc
gh api repos/<owner>/<repo>/pulls/<number>/comments -X POST \
  -f in_reply_to=<comment_id> \
  -f body="$(cat <<'MSG'
针对这个建议的回复

具体说明:
- 已采纳
- 已修复
MSG
)"
```

### 4. 查看 PR 文件变更

```bash
# 查看变更的文件列表
gh pr view <number> --json files --jq '.files[] | {path, additions, deletions}'

# 查看具体的 diff
gh pr diff <number>

# 查看特定文件的 diff
gh pr diff <number> --name-only | grep <pattern>
```

## Heredoc 使用规范(强制)

### Issue/PR 评论

```bash
gh issue comment <number> --body-file - <<'MSG'
多行内容
可以包含任意格式
MSG
```

### API 调用

```bash
gh api <endpoint> -f body="$(cat <<'MSG'
多行内容
MSG
)"
```

### 关键约束

- ✅ 使用 `<<'MSG'` 单引号包裹(防止变量展开)
- ✅ heredoc 标记必须独占一行
- ✅ 结束标记必须顶格(无前导空格)
- ⛔ 禁止使用 `\n` 字符(只会产生字面量,不会换行)

## 常见场景

### 场景 1: 回复 Issue 评论

```bash
# 1. 读取 Issue 及评论
gh issue view <number> --json number,title,comments

# 2. 添加回复
gh issue comment <number> --body-file - <<'MSG'
@<username> 感谢反馈

已确认问题,将在下个版本修复。
MSG
```

### 场景 2: 回复 PR 中的代码讨论

```bash
# 1. 查看 PR review comments
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments --jq '.[] | {id, path, line, body, user: .user.login}'

# 2. 回复特定评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments -X POST \
  -f in_reply_to=<comment_id> \
  -f body="$(cat <<'MSG'
已按建议修改

变更内容:
- 使用 TransactionStatus 枚举
- 替换 prisma.getClient()
MSG
)"
```

### 场景 3: 创建 PR

```bash
# 1. 推送分支
git push -u origin <branch-name>

# 2. 创建 PR
gh pr create --title "<标题>" --body-file - <<'MSG'
## 变更概述
- 变更1
- 变更2

## 测试
- 测试内容

close: #<issue-number>
MSG
```

## 详细参考

完整的命令参考、高级用例和故障排除,请参考:

- `references/commands.md` - 完整命令参考
- `references/api_operations.md` - GitHub API 操作模式
- `references/troubleshooting.md` - 常见问题解决

## 安全约束

⚠️ **仅限项目仓库**: 此技能配置为 `shitgood-bradford54/ai-monorepo`

⚠️ **SSH 认证**: Git 操作统一使用 SSH key

⚠️ **评论前确认**: 添加评论或修改前需确认上下文

## 快速参考

| 任务                | 命令                                                                                            |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| 列出 Issues         | `gh issue list --limit 10`                                                                      |
| 读取 Issue          | `gh issue view <number> --json number,title,body,comments`                                      |
| Issue 评论          | `gh issue comment <number> --body-file - <<'MSG' ... MSG`                                       |
| 列出 PRs            | `gh pr list --limit 10`                                                                         |
| 读取 PR             | `gh pr view <number> --json number,title,body,reviews`                                          |
| PR 评论             | `gh pr comment <number> --body-file - <<'MSG' ... MSG`                                          |
| PR review comments  | `gh api repos/<owner>/<repo>/pulls/<number>/comments`                                           |
| 回复 review comment | `gh api repos/<owner>/<repo>/pulls/<number>/comments -X POST -f in_reply_to=<id> -f body="..."` |

---

**验证日期**: 2025-10-27
