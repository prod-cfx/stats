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

## 3) Heredoc（强制）

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

## 4) 认证与账号

- Git/gh 统一走 SSH key
- gh 权限问题：先 `gh auth status`，需要时用 `gh auth switch` / `gh auth login`
