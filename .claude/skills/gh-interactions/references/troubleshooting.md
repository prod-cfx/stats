# 故障排除指南

本文档提供 GitHub CLI 操作中常见问题的诊断和解决方案。

## 认证问题

### 问题: 认证失败

**症状**:

```
HTTP 401: Bad credentials
Authentication required
```

**解决方案**:

1. 检查认证状态:

```bash
gh auth status
```

2. 如果未登录,重新登录:

```bash
gh auth login
# 选择:
# - GitHub.com
# - SSH
# - 浏览器认证
```

3. 验证 token 权限:

```bash
gh auth status | grep "Token scopes"
# 需要包含: repo, workflow
```

4. 刷新认证:

```bash
gh auth refresh -s repo -s workflow
```

### 问题: SSH 认证失败

**症状**:

```
git@github.com: Permission denied (publickey)
```

**解决方案**:

1. 检查 SSH key:

```bash
ssh -T git@github.com
# 预期输出: Hi username! You've successfully authenticated...
```

2. 如果失败,添加 SSH key:

```bash
ssh-keygen -t ed25519 -C "your_email@example.com"
gh ssh-key add ~/.ssh/id_ed25519.pub
```

3. 确认 Git 使用 SSH:

```bash
gh auth status | grep "Git operations protocol"
# 应显示: ssh
```

---

## Issue/PR 操作问题

### 问题: Issue/PR 不存在

**症状**:

```
no issues match your search in owner/repo
could not resolve to a PullRequest with the number of XXX
```

**解决方案**:

1. 确认 Issue/PR 编号:

```bash
# 列出最近的 Issues
gh issue list --limit 20

# 列出最近的 PRs
gh pr list --limit 20
```

2. 检查仓库路径:

```bash
gh repo view --json nameWithOwner
# 确认当前在正确的仓库
```

3. 使用完整路径:

```bash
gh issue view 123 --repo owner/repo
gh pr view 123 --repo owner/repo
```

### 问题: 无法评论

**症状**:

```
Resource not accessible by integration
You do not have permission to create comments
```

**解决方案**:

1. 检查仓库权限:

```bash
gh repo view --json viewerPermission
# 需要: WRITE 或更高权限
```

2. 确认是仓库协作者:

```bash
gh api repos/owner/repo/collaborators/username
```

3. 如果是私有仓库,确认有访问权限:

```bash
gh repo view --json isPrivate,viewerCanAdminister
```

---

## Heredoc 格式问题

### 问题: 换行符不生效

**症状**:

```
# 预期: 多行评论
# 实际: 单行带 \n 字面量
评论第一行\n评论第二行
```

**原因**: 使用了 `\n` 字符串,而非真正的换行

**解决方案**:

```bash
# ❌ 错误: 使用 \n
gh issue comment 123 --body "第一行\n第二行"

# ✅ 正确: 使用 heredoc
gh issue comment 123 --body-file - <<'MSG'
第一行
第二行
MSG
```

### 问题: Heredoc 语法错误

**症状**:

```
syntax error near unexpected token `newline'
```

**常见原因和解决**:

1. **结束标记缩进**:

```bash
# ❌ 错误
gh issue comment 123 --body-file - <<'MSG'
内容
  MSG  # 有前导空格

# ✅ 正确
gh issue comment 123 --body-file - <<'MSG'
内容
MSG  # 顶格
```

2. **忘记单引号**:

```bash
# ❌ 可能导致变量展开
gh issue comment 123 --body-file - <<MSG
价格: $100  # $100 可能被展开为变量
MSG

# ✅ 正确
gh issue comment 123 --body-file - <<'MSG'
价格: $100  # 字面量
MSG
```

3. **heredoc 标记不独占一行**:

```bash
# ❌ 错误
gh issue comment 123 --body-file - <<'MSG' 内容
MSG

# ✅ 正确
gh issue comment 123 --body-file - <<'MSG'
内容
MSG
```

---

## API 操作问题

### 问题: API 速率限制

**症状**:

```
API rate limit exceeded
X-RateLimit-Remaining: 0
```

**解决方案**:

1. 检查速率限制状态:

```bash
gh api rate_limit --jq '.resources.core'
# 输出:
# {
#   "limit": 5000,
#   "remaining": 0,
#   "reset": 1234567890
# }
```

2. 查看重置时间:

```bash
gh api rate_limit --jq '.resources.core.reset' | xargs -I {} date -r {}
# 输出: Thu Oct 27 10:30:00 CST 2025
```

3. 等待重置或使用更高配额的 token:

```bash
# 等待到重置时间,或
# 使用 Personal Access Token (5000/小时)
# 而非 OAuth token (60/小时)
```

### 问题: Review Comment ID 不存在

**症状**:

```
Not Found
{
  "message": "Not Found",
  "documentation_url": "..."
}
```

**解决方案**:

1. 列出所有 review comments:

```bash
gh api repos/owner/repo/pulls/123/comments --jq '.[].id'
```

2. 确认 comment_id 格式正确(数字,非字符串):

```bash
# ✅ 正确
gh api repos/owner/repo/pulls/123/comments -X POST -f in_reply_to=2464142141

# ❌ 错误
gh api repos/owner/repo/pulls/123/comments -X POST -f in_reply_to="2464142141"
```

3. 确认评论属于该 PR:

```bash
gh api repos/owner/repo/pulls/123/comments --jq '.[] | select(.id == 2464142141)'
```

### 问题: 无法回复已解决的评论

**症状**:

```
Unprocessable Entity
Comment thread is resolved
```

**解决方案**:

1. 先取消解决状态:

```bash
# 使用 GitHub web 界面取消"Resolve conversation"
# 或使用 GraphQL API (gh api graphql ...)
```

2. 或添加新的评论线程:

```bash
gh api repos/owner/repo/pulls/123/comments -X POST \
  -f commit_id=<sha> \
  -f path=<path> \
  -f line=<line> \
  -f body="新的讨论"
```

---

## JSON/jq 查询问题

### 问题: jq 语法错误

**症状**:

```
jq: parse error: ...
```

**常见错误和解决**:

1. **字符串引号**:

```bash
# ❌ 错误: 外层双引号,内层双引号冲突
gh api ... --jq ".[] | select(.path == "file.ts")"

# ✅ 正确: 外层双引号,内层单引号
gh api ... --jq '.[] | select(.path == "file.ts")'

# ✅ 或: 外层单引号
gh api ... --jq '.[] | select(.path == "file.ts")'
```

2. **变量引用**:

```bash
# ❌ 错误: 变量未定义
gh api ... --jq '.[] | select(.id == $id)'

# ✅ 正确: 使用 --arg 传递变量
gh api ... --jq --arg id "123" '.[] | select(.id == ($id | tonumber))'
```

3. **数组切片**:

```bash
# ✅ 正确: 限制前 10 个
gh api ... --jq '.[:10]'

# ✅ 正确: 每个元素处理后限制
gh api ... --jq '.[:10] | .[] | {id, body}'
```

### 问题: 输出格式不符预期

**症状**:

```
# 预期: JSON 对象
# 实际: 多行文本
```

**解决方案**:

```bash
# 每个元素单独输出
gh api ... --jq '.[] | {id, body}'

# 包装为数组
gh api ... --jq '[.[] | {id, body}]'

# 仅提取单个字段
gh api ... --jq '.[].id'

# 格式化为表格
gh api ... --jq -r '.[] | [.id, .path, .line] | @tsv'
```

---

## 性能问题

### 问题: 查询响应慢

**解决方案**:

1. **限制返回字段**:

```bash
# ❌ 差: 返回所有字段
gh issue view 123 --json number,title,body,comments,labels,assignees,milestone

# ✅ 好: 仅返回需要的字段
gh issue view 123 --json number,title,body
```

2. **限制数量**:

```bash
# 限制评论数量
gh issue view 123 --json comments --jq '.comments[:10]'

# 限制列表长度
gh issue list --limit 20  # 默认 30
```

3. **使用分页**:

```bash
# 自动处理分页
gh api repos/owner/repo/pulls/123/comments --paginate
```

### 问题: 大量 API 调用触发速率限制

**解决方案**:

1. **批量操作**:

```bash
# ❌ 差: 循环调用
for id in 1 2 3 4 5; do
  gh issue view $id --json body
done

# ✅ 好: 单次获取列表
gh issue list --limit 5 --json number,body
```

2. **缓存结果**:

```bash
# 缓存到文件
gh api repos/owner/repo/pulls/123/comments > /tmp/pr_comments.json

# 后续使用缓存
cat /tmp/pr_comments.json | jq '.[] | {id, body}'
```

---

## 工作流调试

### 调试 heredoc

```bash
# 1. 测试 heredoc 内容
cat <<'MSG'
测试内容
多行文本
MSG

# 2. 验证变量不展开
var="test"
cat <<'MSG'
变量: $var  # 应显示 $var,而非 test
MSG
```

### 调试 jq 查询

```bash
# 1. 分步调试
gh api ... --jq '.'              # 完整输出
gh api ... --jq '.[]'            # 数组元素
gh api ... --jq '.[] | .id'      # 提取 id
gh api ... --jq '.[] | {id, path}'  # 组装对象
```

### 调试 API 调用

```bash
# 1. 使用 -i 查看响应头
gh api repos/owner/repo/pulls/123/comments -i

# 2. 使用 --verbose 查看详细日志
GH_DEBUG=1 gh api repos/owner/repo/pulls/123/comments
```

---

## 常见错误代码

| HTTP 状态码 | 含义                  | 常见原因           | 解决方案                  |
| ----------- | --------------------- | ------------------ | ------------------------- |
| 401         | Unauthorized          | Token 过期或无效   | 重新登录: `gh auth login` |
| 403         | Forbidden             | 权限不足或速率限制 | 检查权限或等待速率重置    |
| 404         | Not Found             | 资源不存在         | 确认 Issue/PR/Comment ID  |
| 422         | Unprocessable Entity  | 请求数据无效       | 检查必需字段和数据格式    |
| 500         | Internal Server Error | GitHub 服务器错误  | 稍后重试                  |

---

## 获取帮助

### 查看命令帮助

```bash
# gh 总帮助
gh --help

# Issue 子命令帮助
gh issue --help

# PR 子命令帮助
gh pr --help

# API 帮助
gh api --help
```

### 启用调试模式

```bash
# 环境变量启用调试
GH_DEBUG=1 gh issue view 123

# 或
GH_DEBUG=api gh api repos/owner/repo/pulls/123/comments
```

### 查看版本

```bash
gh --version
```

---

## 快速检查清单

当遇到问题时,按顺序检查:

- [ ] `gh auth status` - 认证状态正常?
- [ ] `gh repo view --json nameWithOwner` - 在正确的仓库?
- [ ] `gh api rate_limit` - API 配额充足?
- [ ] Heredoc 格式正确?(结束标记顶格、使用单引号)
- [ ] jq 查询语法正确?(字符串引号、数组切片)
- [ ] Issue/PR/Comment ID 存在且正确?
- [ ] Token 权限包含 `repo` 和 `workflow`?

---

**文档版本**: 2025-10-27
