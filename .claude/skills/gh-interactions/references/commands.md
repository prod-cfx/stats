# GitHub CLI 完整命令参考

本文档提供 `gh` CLI 工具的详细命令参考,涵盖 Issue、PR、Review 等核心操作。

## 认证与配置

### 检查认证状态

```bash
# 查看认证状态
gh auth status

# 输出示例:
# github.com
#   ✓ Logged in to github.com account bradford54 (keyring)
#   - Active account: true
#   - Git operations protocol: ssh
#   - Token: gho_************************************
#   - Token scopes: 'admin:public_key', 'gist', 'read:org', 'repo', 'workflow'
```

### 仓库信息

```bash
# 查看当前仓库信息
gh repo view --json nameWithOwner,defaultBranchRef

# 输出示例:
# {"defaultBranchRef":{"name":"main"},"nameWithOwner":"shitgood-bradford54/ai-monorepo"}
```

---

## Issue 操作

### 列出 Issues

```bash
# 列出最近的 Issues
gh issue list --limit 10

# 列出打开的 Issues
gh issue list --state open --limit 20

# 按标签过滤
gh issue list --label bug --limit 10

# 按作者过滤
gh issue list --author @me

# JSON 格式输出
gh issue list --limit 10 --json number,title,author,state,createdAt
```

### 查看 Issue 详情

```bash
# 基础查看
gh issue view <number>

# JSON 格式(基础信息)
gh issue view <number> --json number,title,body,author,state,createdAt

# 包含评论(限制数量)
gh issue view <number> --json number,title,body,comments --jq '{number,title,body,comments: .comments[:5]}'

# 完整评论列表
gh issue view <number> --json number,title,body,comments
```

### Issue 评论

```bash
# 基础评论
gh issue comment <number> --body "简短评论"

# 多行评论(heredoc 格式 - 推荐)
gh issue comment <number> --body-file - <<'MSG'
评论标题

详细内容:
- 要点1
- 要点2

结论部分
MSG
```

### 创建 Issue

```bash
# 交互式创建
gh issue create

# 非交互式创建
gh issue create --title "Bug: XXX 功能异常" --body-file - <<'MSG'
## 问题描述
XXX 功能在 YYY 场景下出现异常。

## 复现步骤
1. 步骤1
2. 步骤2

## 预期行为
应该正常工作。

## 实际行为
报错信息: ...
MSG

# 指定标签和负责人
gh issue create --title "Feature: 新增 XXX" --label enhancement --assignee @me --body "描述"
```

---

## Pull Request 操作

### 列出 PRs

```bash
# 列出最近的 PRs
gh pr list --limit 10

# 列出我的 PRs
gh pr list --author @me

# 按状态过滤
gh pr list --state open --limit 20
gh pr list --state merged --limit 10

# JSON 格式输出
gh pr list --limit 10 --json number,title,author,state,createdAt,headRefName
```

### 查看 PR 详情

```bash
# 基础查看
gh pr view <number>

# JSON 格式(基础信息)
gh pr view <number> --json number,title,body,author,state,createdAt

# 包含 reviews 和 comments
gh pr view <number> --json number,title,body,reviews,comments --jq '{number,title,body,reviews: .reviews[:3],comments: .comments[:3]}'

# 查看文件变更列表
gh pr view <number> --json files --jq '.files[] | {path, additions, deletions}'
```

### PR 评论

```bash
# 基础评论
gh pr comment <number> --body "LGTM"

# 多行评论(heredoc 格式 - 推荐)
gh pr comment <number> --body-file - <<'MSG'
反馈意见

变更建议:
- 建议1: 使用枚举代替字符串
- 建议2: 添加错误处理

其他:
- 测试覆盖率良好
MSG
```

### 创建 PR

```bash
# 交互式创建
gh pr create

# 非交互式创建(heredoc 格式 - 推荐)
gh pr create --title "feat: 添加 XXX 功能" --body-file - <<'MSG'
## 变更概述
实现了 XXX 功能,主要包括:
- 功能点1
- 功能点2

## 测试验证
- ✅ 单元测试通过
- ✅ E2E 测试通过
- ✅ 手动测试完成

## 相关 Issue
close: #123

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
MSG

# 指定目标分支和审阅人
gh pr create --base main --head feat/xxx --reviewer @user1,@user2
```

### PR Diff 查看

```bash
# 查看完整 diff
gh pr diff <number>

# 查看变更的文件名
gh pr diff <number> --name-only

# 查看特定文件的 diff
gh pr diff <number> -- path/to/file.ts
```

### PR Review

```bash
# 批准 PR
gh pr review <number> --approve

# 请求修改
gh pr review <number> --request-changes --body-file - <<'MSG'
需要修改以下问题:
- 问题1
- 问题2
MSG

# 仅评论(不批准也不拒绝)
gh pr review <number> --comment --body-file - <<'MSG'
一些建议:
- 建议1
- 建议2
MSG
```

---

## PR Review Comments (代码级评论)

### 读取 Review Comments

```bash
# 使用 GitHub API 获取代码级评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments

# 格式化输出(仅显示关键字段)
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments \
  --jq '.[] | {id, path, line, body, user: .user.login}'

# 限制数量
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments \
  --jq '.[:10] | .[] | {id, path, position, original_position, line, original_line, body}'
```

### 回复 Review Comment

```bash
# 简短回复
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments \
  -X POST \
  -f in_reply_to=<comment_id> \
  -f body="已修复"

# 多行回复(heredoc 格式 - 推荐)
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments \
  -X POST \
  -f in_reply_to=<comment_id> \
  -f body="$(cat <<'MSG'
已按建议修改

具体变更:
- 使用 TransactionStatus 枚举代替字符串
- 使用 prisma.getClient() 确保事务参与
- 添加了单元测试覆盖

提交: abc1234
MSG
)"
```

### 添加新的 Review Comment

````bash
# 在特定行添加评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments \
  -X POST \
  -f path="apps/backend/src/modules/activity/services/user.activity.service.ts" \
  -f line=20 \
  -f body="建议使用枚举代替字符串字面量"

# 在特定位置添加多行评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/comments \
  -X POST \
  -f path="apps/backend/src/modules/activity/services/user.activity.service.ts" \
  -f line=474 \
  -f body="$(cat <<'MSG'
建议使用 CLS 绑定的 Prisma 客户端

```typescript
const client = this.prisma.getClient()
const wallet = await client.wallet.findUnique(...)
````

MSG
)"

````

---

## 高级查询(GitHub API)

### 查看 PR 状态详情

```bash
# 查看 CI 检查状态
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/commits/<sha>/check-runs

# 查看评审状态
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/reviews
````

### 查看提交历史

```bash
# 查看 PR 的所有提交
gh api repos/shitgood-bradford54/ai-monorepo/pulls/<number>/commits \
  --jq '.[] | {sha: .sha[:7], message: .commit.message, author: .commit.author.name}'
```

---

## 输出格式控制

### JSON 输出

```bash
# 完整 JSON
gh issue view <number> --json number,title,body

# 使用 jq 格式化
gh issue view <number> --json number,title,comments --jq '.comments[] | .body'

# 限制数组长度
gh issue view <number> --json comments --jq '.comments[:5]'
```

### Web 浏览器

```bash
# 在浏览器中打开 Issue
gh issue view <number> --web

# 在浏览器中打开 PR
gh pr view <number> --web
```

---

## Heredoc 使用最佳实践

### 基础格式

```bash
gh issue comment <number> --body-file - <<'MSG'
多行内容
可以包含任意格式
MSG
```

### 嵌套在 API 调用中

```bash
gh api <endpoint> -f body="$(cat <<'MSG'
多行内容
MSG
)"
```

### 关键要点

1. **使用单引号** `<<'MSG'` 防止变量展开
2. **heredoc 标记独占一行**
3. **结束标记顶格**(无前导空格)
4. **禁止 `\n`**(只会产生字面量)

---

## 常见错误处理

### Issue/PR 不存在

```bash
# 错误信息:
# no issues match your search in shitgood-bradford54/ai-monorepo

# 解决:
# 1. 检查 Issue/PR 编号
# 2. 确认仓库路径
gh repo view --json nameWithOwner
```

### 认证失败

```bash
# 错误信息:
# HTTP 401: Bad credentials

# 解决:
# 1. 检查认证状态
gh auth status

# 2. 重新登录
gh auth login
```

### API 速率限制

```bash
# 检查速率限制状态
gh api rate_limit

# 输出示例:
# {
#   "resources": {
#     "core": {
#       "limit": 5000,
#       "remaining": 4999,
#       "reset": 1234567890
#     }
#   }
# }
```

---

## 快速参考表

| 操作                | 命令                                                          |
| ------------------- | ------------------------------------------------------------- |
| **Issue**           |                                                               |
| 列出 Issues         | `gh issue list --limit 10`                                    |
| 查看 Issue          | `gh issue view <number>`                                      |
| 创建 Issue          | `gh issue create --title "..." --body-file - <<'MSG' ... MSG` |
| 评论 Issue          | `gh issue comment <number> --body-file - <<'MSG' ... MSG`     |
| **PR**              |                                                               |
| 列出 PRs            | `gh pr list --limit 10`                                       |
| 查看 PR             | `gh pr view <number>`                                         |
| 创建 PR             | `gh pr create --title "..." --body-file - <<'MSG' ... MSG`    |
| 评论 PR             | `gh pr comment <number> --body-file - <<'MSG' ... MSG`        |
| 查看 Diff           | `gh pr diff <number>`                                         |
| 批准 PR             | `gh pr review <number> --approve`                             |
| **Review Comments** |                                                               |
| 读取                | `gh api repos/<owner>/<repo>/pulls/<number>/comments`         |
| 回复                | `gh api ... -X POST -f in_reply_to=<id> -f body="..."`        |

---

**文档版本**: 2025-10-27
