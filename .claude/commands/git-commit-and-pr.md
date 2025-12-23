---
allowed-tools: [Bash, Read, Glob, TodoWrite, Edit, Grep]
description: '统一 Git 工作流：自动化创建 Issue、提交与 PR'
---

## Usage

```bash
# 默认：无参数时根据状态自动执行所需阶段
/git-commit-and-pr [--issue <ISSUE_ID>] [--message <COMMIT_MESSAGE>]

# 仅创建或补全 Issue（不碰 Commit/PR）
/git-commit-and-pr --issue-only [--title <TITLE>] [--labels <l1,l2>] [--assignees <ASSIGNEES>]

# Commit → PR 全流程（若缺 Issue 会先创建）
/git-commit-and-pr --all [--issue <ISSUE_ID>] [--base <BASE_BRANCH>] [--title <TITLE>]

# 仅创建 PR（工作目录需干净，如缺 Issue 同样自动补齐）
/git-commit-and-pr --pr [--issue <ISSUE_ID>] [--base <BASE_BRANCH>]
```

- `--issue <ISSUE_ID>`：显式指定 Issue；缺失时命令会触发 Issue 阶段
- `--issue-only`：只执行 Issue 阶段，适合先整理需求
- `--all`：串行执行 Issue → Commit → PR
- `--pr`：跳过 Commit，仅在已有提交上创建 PR
- `--message`：自定义提交说明（仍需使用 heredoc 生成实际提交信息）
- `--title`/`--labels`/`--assignees`：透传 Issue 创建参数
- `--base`：PR 基础分支（默认 `main`）

## 背景与约束

- 增量预检必须在提交前完成：`./scripts/dx lint`；如改动涉及后端需先跑 `./scripts/dx build backend`，再按需执行 `./scripts/dx build sdk --online`、`./scripts/dx build front`、`./scripts/dx build admin`
- 若执行了 `./scripts/dx build sdk --online`，需检查 `apps/sdk/openapi/openapi.json` 是否应当提交，若无 DTO/API 变更应恢复原状
- 所有提交与 PR 必须关联 Issue（`Refs: #<id>` / `Closes: #<id>`）
- Main 分支禁止直接提交与开 PR，只有增量预检、E2E 全通过且获得明确确认时才可例外
- 提交与 PR 文本必须使用 heredoc（Git/GH CLI），且全程使用中文
- 禁止将外部 I/O 放入事务；保持质量守护职责与仓库风格指南一致

## 角色职责

1. **状态检查员**：解析参数、读取 `git status` 与 `git branch --show-current`
2. **Issue 协调者**：必要时调用 issue-creator agent 生成规范 Issue
3. **分支管理员**：确保在符合规范的功能分支上工作，如在 `main` 需提示分支迁移
4. **质量守护者**：执行增量预检、选择并运行必要的构建/测试、检查 OpenAPI
5. **提交协调员**：生成提交信息、执行 heredoc 提交、核对变更
6. **PR 生成器**：整理变更摘要、生成 PR 标题与正文（heredoc）
7. **追踪维护员**：在 Issue 下回填提交与 PR 信息，保证闭环

## 模式识别

```
初始化 → 检查是否需要 Issue → 确定是否存在未提交修改 → 判定执行阶段
```

- **Issue 阶段**：`--issue-only`、`--all`、无 `--issue` 且缺 Issue、或当前分支不符合规范时触发
- **Commit 阶段**：存在未提交修改且不在 `--pr`/`--issue-only` 模式
- **PR 阶段**：`--pr`、`--all` 或用户指定，仅在工作树干净且位于功能分支时执行
- 若无待办事项则向用户回报当前状态（如工作目录干净、已有 PR 等）

## 工作流阶段

### 阶段 0：初始化

1. 解析所有参数并向用户复述计划
2. 运行 `git status --short` 与 `git branch --show-current`
3. 判定当前分支：若在 `main`/`master`，提示用户必须切换或创建新分支（任何非 main/master 的分支名均可，推荐 `type/<issue>-<desc>` 格式）；如用户坚持留在主分支，标记为高风险并要求完成全部增量预检与 E2E
4. 初始化 TodoList，列出需要执行的阶段

### 阶段 1：Issue 保障（按需）

1. 如用户提供 `--issue`，验证其存在；若缺 Issue 或在主分支需创建新 Issue，进入本阶段
2. 汇总上下文：
   - 近期对话中的问题描述与目标
   - `git status`、`git diff --stat`、核心文件片段
   - 受影响模块与潜在风险
3. 调用 Task tool，使用 issue-creator agent，模板如下：

```
Use Task tool with issue-creator agent:
"请根据当前对话上下文和代码变更创建 GitHub Issue

用户参数：
- 标题: <若用户提供 --title>
- 标签: <若用户提供 --labels>
- 指派: <若用户提供 --assignees>

分析重点：
- 从对话历史中提取问题描述和需求背景
- 分析代码变更（git status, git diff）
- 识别受影响模块与范围，检查是否有重复 Issue

输出要求：
- 生成结构化 Issue 内容（背景、现状、期望、计划、影响）
- 使用 gh CLI，以 heredoc 方式创建 Issue
- 返回 Issue 编号与链接"
```

4. 接收 agent 输出，记录 Issue 号并在后续所有阶段引用；若创建失败需反馈原因并终止
5. `--issue-only` 模式在此阶段完成后直接结束，提示后续动作（如在提交/PR 时引用 Issue）

### 阶段 2：Commit 流程

1. 确认存在未提交修改，若无则跳过或提示
2. 再次核对分支命名及 Issue 关联，用 `git status` 列出所有待提交文件
3. 执行增量预检：
   - `./scripts/dx lint`（必跑）
   - 如涉及后端或共享逻辑：`./scripts/dx build backend`
   - 若 DTO/API 有改动：紧接运行 `./scripts/dx build sdk --online`，随后检查 `openapi.json`
   - 根据改动选择性执行 `./scripts/dx build front` / `./scripts/dx build admin`
4. 若预检失败必须停止并提示修复；必要时记录假设（assumption）
5. 生成提交信息草案：
   - 遵循 Conventional Commits
   - 用中文描述变更点（2-4 条 bullet）
   - 追加 `Refs: #<issue-id>` 或 `Closes: #<issue-id>`
6. 使用 heredoc 执行提交：

```bash
git commit -F - <<'MSG'
<type>: <概要>

变更说明：
- ...
- ...

Refs: #<issue-id>
MSG
```

7. 提交后运行 `git status` 确认工作树干净，并向 Issue 评论提交哈希（如流程要求）

### 阶段 3：PR 流程

1. 确认当前在功能分支且工作树干净；若存在未提交修改需回到阶段 2
2. 审查提交列表与差异，生成 PR 摘要（变更点、测试结果、风险、回滚方案）
3. 若 PR 目标分支为 `main` 或高风险改动，需确保受影响的后端 E2E 测试逐个运行并通过：`./scripts/dx test e2e backend <file-or-dir>`
4. 通过 heredoc 运行 `gh pr create`（或 `gh pr draft create`，视需求）并确保正文包含：
   - 变更概览
   - 测试/验证结果
   - 风险评估与回滚策略
   - `Closes: #<issue-id>` 或 `Refs: #<issue-id>`
5. PR 创建成功后，更新 Issue 评论并附上 PR 链接；如命令在 `--all` 模式运行，需在输出中明确宣告全流程完成
6. ⚠️ **重要提示**：创建 PR 后，如出现 review threads（`discussion_rXXXXXXX`），必须使用 `/pr-fix-pilot <PR_NUMBER>` 命令处理：
   - 该命令会识别并记录所有 `discussion_rXXXXXXX` 线程 ID
   - 在 Phase E 中逐条核对并单独回复每个线程（禁止遗漏）
   - 对每个线程使用 `gh api` 在线程内回复，而非在 PR 总评论中回复

## Delegation

- **issue-creator agent**：负责 Issue 内容分析、生成与 `gh issue create` 执行
- **command 层**：参数解析、阶段调度、质量守护、Git/PR 操作与回执展示

## 输出约定

```
✅ 阶段完成说明

Issue: #<编号> <标题>
Commit: <哈希> <主题>
PR: !<编号> <标题>

后续动作：
- [ ] 在 Issue 下补充 <描述>
- [ ] 执行 <命令>
- [ ] ⚠️ 如有 review threads（discussion_rXXXXXXX），使用 `/pr-fix-pilot <PR_NUMBER>` 处理
```

- 未执行的阶段以 ⚠️/ℹ️ 说明原因（例如工作树干净、预检失败、等待用户确认）
- PR 创建成功后，必须在输出中明确提示：后续 review threads 需使用 `/pr-fix-pilot` 命令处理，并强调逐条回复每个 `discussion_rXXXXXXX` 线程（禁止遗漏）
- 遵循仓库中文输出规范

## Key Constraints

### Git 操作

- 命令必须在仓库根目录执行，统一使用 SSH 认证
- 禁止使用 `-m`/`-b` 直接嵌入多行文本；所有提交、PR、Issue 文本采用 heredoc
- 严禁未获确认的破坏性操作（如 `git reset --hard`）

### 分支策略

- 禁止在 `main`/`master` 分支直接提交，必须使用其他分支
- 推荐分支命名：`<type>/<issue-id>-<description>`（如 `feat/123-add-feature`）
- 提交前确认远端分支同步情况，必要时 `git fetch --all`

### Issue 关联

- 每次提交/PR 必须引用有效 Issue
- 无 Issue 时必须先完成阶段 1 创建 Issue
- 推送后需在 Issue 中评论提交哈希与 PR 链接

### 质量门禁

- 增量预检通过是提交前置条件
- 执行过 `./scripts/dx build sdk --online` 后必须审查 `openapi.json`
- 高风险改动需列出回滚方案和潜在影响，必要时再次确认假设（assumption）

### 提交通知

- 提交信息使用中文，保持精炼（不超过 72 字符主题）
- 变更说明聚焦核心差异，避免罗列实现细节

## Success Criteria

- ✅ Issue（新建或复用）信息完整，可在后续提交/PR 中引用
- ✅ 增量预检与必要测试全部通过，失败时明确说明阻塞
- ✅ 提交/PR 文本符合规范并使用 heredoc 生成
- ✅ OpenAPI、E2E 等高风险点得到确认或注明假设
- ✅ 输出清晰罗列已完成与待完成事项，确保使用者能快速跟进

## 示例场景

### 1. 有未提交修改，缺 Issue

```
/git-commit-and-pr --all
→ 检测到缺失 Issue → 调用 issue-creator agent
→ 生成 Issue #123
→ 执行增量预检 + Commit
→ 创建 PR 并关联 Issue
→ 完成全流程
```

### 2. 仅创建 Issue 的准备阶段

```
/git-commit-and-pr --issue-only --title "修复钱包结算错误"
→ 调用 issue-creator agent → 输出 Issue #456
→ 提示后续提交需使用 Refs: #456
```

### 3. 工作树干净，仅需创建 PR

```
/git-commit-and-pr --pr --issue 789
→ 验证分支与增量预检记录
→ 生成 PR 正文并创建
→ 提示更新 Issue 进度
```

统一命令，掌控 Issue → Commit → PR 的完整闭环，确保流程清晰、质量达标、追踪完整。🚀
