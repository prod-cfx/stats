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

- 多行 commit message / PR body / Issue body 必须用 heredoc（`<<'MSG' ... MSG`），不得用 `git commit -m "...\n..."` / `gh pr create --body "...\n..."` 这种 `-m` / `--body` 单行参数加 `\n` 拼装的写法——shell 不会把字面 `\n` 解释为换行，最终入库的是 `\n` 两个字符
- 不要在参数里写 `\n`（只会产生字面量）

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

## 5) GitHub Markdown 引用（强制）

- 在 PR body、Issue/PR 评论、review 评论中，`#123` 只用于真实引用 GitHub Issue/PR（如 `Refs: #4896`、`Closes: #4896`）
- 表示「第 1 个问题 / 第 2 个任务 / PR train 第 1 段」等普通序号时，禁止写 `#1`、`#2`、`#2..#9`，避免被 GitHub 自动解析成 1 号、2 号 Issue/PR
- 普通序号统一写成 `第 1 个问题`、`问题 1`、`PR1`、`Task 1`、`C1`、`[1]` 或反引号包裹的 `` `#1` ``；跨段范围写 `PR2..PR9` 或 `第 2-9 段`

## 6) Issue 模板（强制）

每个 Issue 必须包含「背景 / 目标 / 验收标准」三节，「方案」可选：

```markdown
## 背景

为什么要做这件事：现状、痛点、触发场景、相关上下文链接。

## 目标

做完之后世界变成什么样：可观察的、可验证的结果，不是动作清单。

## 方案（可选）

如果已有倾向性方案就写；没有就留空让执行人决定，不要为了凑格式硬写。

## 验收标准

- [ ] 一条一条可勾选，单条只判定一件事
- [ ] 必须客观可验证（命令输出 / 行为表现 / 数据状态），禁止「代码更优雅」这类主观项
- [ ] 覆盖所有要解决的问题；遗漏即视为不在本 Issue 范围内
```

约束：

- 验收标准的每一条最终会在 PR 合并前被逐项核对，写不出可验证标准说明目标没想清楚，先回到「目标」打磨
- 「方案」一栏不是契约，PR 实施时如有更优方案应在 PR body 写明偏离原因

## 7) PR 描述模板（强制）

每个 PR body 必须包含以下结构：

```markdown
## 已解决的问题

- 对应 Issue 验收标准的逐条落点（建议引用：`对应 Issue 验收标准 [1]`）
- 关键代码改动概述（不是 diff 复述，是「做了什么决策」）

## 遗留的问题

- 本 PR 未覆盖、但属于 Issue 范围的项 → 必须给出后续 Issue/PR 编号或显式说明「拆到 #NNN」
- 发现的新问题 → 新建 Issue 并在此引用，不要只在 PR 评论里提

## 已做的验证

- 测试：列出新增/修改的测试文件与用例名
- 命令：贴最低限度的执行证据（`dx lint`、`dx build <target> --dev`、`dx test unit/e2e ...` 的关键输出）
- 手测：关键路径的人工验证步骤与结果（截图/链接可选）

##  PR 遗留未做的

- 显式列出仍欠的动作（迁移、灰度、文档、回滚预案等）
- 每条必须挂一个 owner 或后续 Issue 编号；空着等于没说

## 关联

- Closes: #<issue-id>          # 用 Closes 让 GitHub 合并时自动关 Issue
- Refs:   #<其他 issue/pr-id>  # 仅引用、不自动关
```

约束：

- 「已做的验证」禁止只写「已通过本地测试」，必须可被他人复现
- 「必须做但本 PR 未做的」如果为空，明确写「无」，不要省略整节
- 「遗留的问题」与「必须做但本 PR 未做的」语义不同：前者是**事实层**——「我们知道还欠什么」，含原 Issue 范围内未做完的项与本次新发现的问题；后者是**承诺层**——「我们承诺接下来要做什么」，每条必须挂 owner 或后续 Issue 编号
- PR 标题遵循 §2 Conventional Commits；body 用 `gh pr create --body-file -` 加 heredoc 提交（§3）

## 8) 合并前自检与合并后回访（强制）

「合并人」指实际点击 GitHub「Merge」按钮的人，不必是 PR 作者；作者自合并场景下作者本人即合并人，规则一视同仁。CODEOWNERS 与 branch protection 是基础设施层兜底，不替代本节自检——制度上的「可以合并」不等于「应该合并」。

**合并前**（点击「Merge」之前必须完成）：

1. **核对 Issue 验收标准**：打开关联 Issue，逐条对照「实际代码改动」勾选，**禁止只看 PR 描述就勾**
   - 描述说做了，代码没做 → 退回作者
   - 代码做了但不在验收标准里 → 评估是否要补 Issue 或拆 PR
2. **核对 PR 内置 checklist**：CI 全绿、required reviews 已通过、所有 conversation resolved、无未回应的 change request、分支保护规则未被绕过、commit 签名（如已启用 GPG/SSH 签名要求）有效
   - 每一项都要点开看，不要因为 GitHub 显示「mergeable」就跳过
   - 若 PR 含 Prisma 迁移、`CHANGELOG.md`、`api-contracts` 等高冲突文件，本地拉一次 `origin/main` 确认无静默冲突
   - 合并策略遵循仓库默认（squash / merge / rebase）；如临时切换，需在 PR body 写明原因
3. **核对关联引用**：PR body 中存在 `Closes: #<issue-id>`（让 GitHub 在 merge 时自动关 Issue），多 Issue 场景每个都要单独 `Closes:` 一行
4. **核对遗留项**：PR body 「必须做但本 PR 未做的」中列出的项，要么已新建后续 Issue 并附编号，要么已在本 PR 内补做，禁止「merge 后再说」

**合并后**（点击「Merge」之后必须完成）：

5. **回访 Issue 状态**：确认 GitHub 因 `Closes:` 自动关闭的 Issue 状态正确；若有验收标准未被本 PR 完全覆盖，重开 Issue 或拆出 follow-up，不要让 Issue 在未完成状态下被 `Closes:` 误关

约束：

- 第 1、4 步是硬门槛，发现不一致一律退回，**不要带病合并 + 口头承诺事后补**
- 自检过程中如对代码是否真完成存疑，运行一次相关 `dx lint` / `dx build` / `dx test` 比相信描述更靠谱
