# Git 与 GitHub 规范

## 1) Issue 与分支（强制）

- 提交/发 PR 前必须有 Issue ID（无则先创建或指定）
- 提交必须在 Issue 分支：
  - 标准：`feat/<id>-*` / `fix/<id>-*` / `refactor/<id>-*` / `docs/<id>-*` / `chore/<id>-*` / `test/<id>-*`
  - Codex 会话兼容：`codex/feat/<id>-*` / `codex/fix/<id>-*` / `codex/refactor/<id>-*` / `codex/docs/<id>-*` / `codex/chore/<id>-*` / `codex/test/<id>-*`
- 禁止直接提交到 `main/master`

## 2) 提交格式

- Conventional Commits：`feat:` / `fix:` / `docs:` / `refactor:` ...
- 末尾必须带：`Refs: #123` 或 `Closes: #123`
- Commit message 必须同时遵守 Lore 协议：首行写“为什么改”，正文按需说明约束与取舍，并用 git trailer 记录验证证据
- 推荐 trailer：`Constraint:`、`Rejected:`、`Confidence:`、`Scope-risk:`、`Directive:`、`Tested:`、`Not-tested:`
- `Tested:` 必须写实际执行过的验证；未验证的风险写入 `Not-tested:`

## 3) GitHub 文案编号（强制）

- 在 Issue、PR、评论、提交说明等 GitHub 会渲染 Markdown 的地方，禁止用 `#1`、`#2` 这类格式表示“第 1 个问题 / 第 2 个问题”
- 测试名、代码注释、文档片段如果可能被复制到 Issue/PR/Review，也不要用裸 `#1`、`#2` 表示普通序号
- 原因：GitHub 会把 `#1` 自动解析为仓库 Issue/PR 编号，容易造成错误引用和沟通混乱
- 可用替代格式：`问题 1`、`问题 2`、`第 1 点`、`第 2 点`、`1.` / `2.`、`(1)` / `(2)`、`[1]` / `[2]`
- 只有在明确引用 GitHub Issue/PR 时，才使用 `#123`

## 4) Heredoc（强制）

说明：不要在参数里写 `\n`（只会产生字面量）。

```bash
git commit -F - <<'MSG'
feat: 功能摘要

变更说明：
- 变更点1
- 变更点2

Refs: #123
MSG
```

```bash
gh pr create --title "..." --body-file - <<'MSG'
## 变更说明
- 变更点1

Closes: #123
MSG
```

## 5) 认证与账号

- Git/gh 统一走 SSH key
- gh 权限问题：先 `gh auth status`，需要时用 `gh auth switch` / `gh auth login`
