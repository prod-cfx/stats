# GitHub API 操作模式

本文档详细说明通过 `gh api` 进行 GitHub REST API 调用的模式,特别是 PR review comments 相关操作。

## API 基础

### 基本调用格式

```bash
gh api <endpoint> [flags]
```

### 常用 flags

| Flag         | 说明             | 示例                    |
| ------------ | ---------------- | ----------------------- | ----- |
| `-X`         | HTTP 方法        | `-X POST`, `-X PATCH`   |
| `-f`         | 字段参数(string) | `-f body="评论内容"`    |
| `-F`         | 字段参数(file)   | `-F file=@path/to/file` |
| `--jq`       | jq 表达式过滤    | `--jq '.[]              | .id'` |
| `-i`         | 包含响应头       | `-i`                    |
| `--paginate` | 自动分页         | `--paginate`            |

---

## PR Review Comments API

### API 端点

```
GET    /repos/{owner}/{repo}/pulls/{pull_number}/comments
POST   /repos/{owner}/{repo}/pulls/{pull_number}/comments
PATCH  /repos/{owner}/{repo}/pulls/comments/{comment_id}
DELETE /repos/{owner}/{repo}/pulls/comments/{comment_id}
```

### 数据结构

#### Comment 对象关键字段

```json
{
  "id": 2464142141,
  "path": "apps/backend/src/modules/activity/services/user.activity.service.ts",
  "position": 1, // 当前 diff 中的位置
  "original_position": 5, // 原始 diff 中的位置
  "line": 20, // 当前代码行号
  "original_line": 19, // 原始代码行号
  "body": "建议使用枚举代替字符串",
  "user": {
    "login": "coderabbitai[bot]"
  },
  "created_at": "2025-10-26T...",
  "in_reply_to_id": null // 如果是回复,则包含父评论 ID
}
```

---

## 核心操作模式

### 1. 读取所有 Review Comments

```bash
# 基础读取
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments

# 格式化输出(仅关键字段)
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[] | {id, path, line, body, user: .user.login}'

# 限制数量
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[:10] | .[] | {id, path, position, line, body}'

# 分页读取(处理大量评论)
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments --paginate
```

### 2. 过滤特定文件的评论

```bash
# 仅显示特定文件的评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[] | select(.path == "apps/backend/src/modules/activity/services/user.activity.service.ts") | {id, line, body}'
```

### 3. 查找需要回复的评论

```bash
# 查找未回复的评论(in_reply_to_id 为 null)
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[] | select(.in_reply_to_id == null) | {id, path, line, body, user: .user.login}'

# 查找特定用户的评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[] | select(.user.login == "coderabbitai[bot]") | {id, path, line, body}'
```

### 4. 回复 Review Comment

#### 简短回复

```bash
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  -X POST \
  -f in_reply_to=2464142141 \
  -f body="已修复"
```

#### 多行回复(heredoc)

```bash
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  -X POST \
  -f in_reply_to=2464142141 \
  -f body="$(cat <<'MSG'
已按建议修改

具体变更:
- 导入 TransactionStatus 枚举
- 将 status: { not: 'FAILED' } 改为 status: { not: TransactionStatus.FAILED }
- 添加了类型安全检查

提交: 591d26a
MSG
)"
```

### 5. 添加新的 Review Comment

````bash
# 在特定行添加评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  -X POST \
  -f commit_id="abc1234567890" \
  -f path="apps/backend/src/modules/activity/services/user.activity.service.ts" \
  -f line=20 \
  -f body="建议添加错误处理"

# 多行评论(带代码建议)
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  -X POST \
  -f commit_id="abc1234567890" \
  -f path="apps/backend/src/modules/activity/services/user.activity.service.ts" \
  -f line=474 \
  -f body="$(cat <<'MSG'
建议使用 CLS 绑定的 Prisma 客户端

```typescript
const client = this.prisma.getClient()
const wallet = await client.wallet.findUnique(...)
````

这样可以确保查询参与到当前事务中。
MSG
)"

````

### 6. 更新已有评论

```bash
# 修改评论内容
gh api repos/shitgood-bradford54/ai-monorepo/pulls/comments/2464142141 \
  -X PATCH \
  -f body="更新后的评论内容"
````

### 7. 删除评论

```bash
# 删除评论(谨慎使用)
gh api repos/shitgood-bradford54/ai-monorepo/pulls/comments/2464142141 \
  -X DELETE
```

---

## 工作流示例

### 工作流 1: 批量回复 Code Review 建议

```bash
# 1. 读取所有未回复的 review comments
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[] | select(.in_reply_to_id == null) | {id, path, line, body}' \
  > /tmp/pr_comments.json

# 2. 查看评论列表
cat /tmp/pr_comments.json

# 3. 逐个回复
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  -X POST \
  -f in_reply_to=<comment_id_1> \
  -f body="$(cat <<'MSG'
已采纳建议并修复

变更内容:
- 具体修改点1
- 具体修改点2

提交: <commit_hash>
MSG
)"

# 重复步骤 3 处理其他评论...
```

### 工作流 2: 查找特定关键词的评论

```bash
# 查找包含特定关键词的评论(如 "enum")
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[] | select(.body | contains("enum")) | {id, path, line, body}'

# 批量回复相关建议
# ...
```

### 工作流 3: 查看评论讨论线程

```bash
# 查找某个评论的所有回复
original_comment_id=2464142141

gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq ".[] | select(.in_reply_to_id == $original_comment_id) | {id, user: .user.login, body, created_at}"
```

---

## 高级查询模式

### 使用 jq 进行复杂过滤

```bash
# 统计每个文件的评论数
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq 'group_by(.path) | .[] | {path: .[0].path, count: length}'

# 找出评论最多的文件
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq 'group_by(.path) | .[] | {path: .[0].path, count: length} | sort_by(.count) | reverse | .[0]'

# 查找最近 24 小时的评论
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq --arg since "$(date -u -v-24H '+%Y-%m-%dT%H:%M:%SZ')" \
  '.[] | select(.created_at > $since) | {id, path, line, body, created_at}'
```

---

## 错误处理

### 常见错误

#### 1. comment_id 不存在

```bash
# 错误响应:
# {
#   "message": "Not Found",
#   "documentation_url": "..."
# }

# 解决:
# 1. 确认 comment_id 正确
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments --jq '.[].id'

# 2. 确认评论属于该 PR
```

#### 2. 权限不足

```bash
# 错误响应:
# {
#   "message": "Resource not accessible by integration"
# }

# 解决:
# 1. 检查 token 权限
gh auth status

# 2. 确认有仓库写权限
```

#### 3. API 速率限制

```bash
# 检查剩余配额
gh api rate_limit --jq '.resources.core'

# 输出示例:
# {
#   "limit": 5000,
#   "remaining": 4999,
#   "reset": 1234567890,
#   "used": 1
# }
```

---

## 性能优化

### 1. 减少 API 调用

```bash
# ❌ 差: 多次调用
for id in $(gh api repos/owner/repo/pulls/123/comments --jq '.[].id'); do
  gh api repos/owner/repo/pulls/comments/$id
done

# ✅ 好: 单次调用获取所有数据
gh api repos/owner/repo/pulls/123/comments --jq '.[] | {id, path, line, body}'
```

### 2. 使用字段过滤

```bash
# 仅获取需要的字段
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --jq '.[] | {id, line, body}'
```

### 3. 分页处理大数据

```bash
# 自动处理分页
gh api repos/shitgood-bradford54/ai-monorepo/pulls/1314/comments \
  --paginate \
  --jq '.[] | {id, path}'
```

---

## 快速参考

| 操作         | 命令                                                                     |
| ------------ | ------------------------------------------------------------------------ | --------------------------------- |
| 读取所有评论 | `gh api repos/<owner>/<repo>/pulls/<number>/comments`                    |
| 格式化输出   | `--jq '.[]                                                               | {id, path, line, body}'`          |
| 回复评论     | `-X POST -f in_reply_to=<id> -f body="..."`                              |
| 添加新评论   | `-X POST -f commit_id=<sha> -f path=<path> -f line=<line> -f body="..."` |
| 更新评论     | `-X PATCH -f body="新内容"`                                              |
| 删除评论     | `-X DELETE`                                                              |
| 过滤特定文件 | `--jq '.[]                                                               | select(.path == "...")`           |
| 查找未回复   | `--jq '.[]                                                               | select(.in_reply_to_id == null)'` |

---

**文档版本**: 2025-10-27
