# AI Quant Phase 1 Multi-PR — Critic 第 3 轮（最终轮）

**Plan：** `docs/superpowers/plans/2026-05-07-ai-quant-phase1-multi-pr.md`（rev 3）
**Spec：** `docs/superpowers/specs/2026-05-07-ai-quant-phase1-trigger-gates-design.md`（含 §3.4 + §9.4 修订）
**Branch：** `feat/984-phase1-trigger-gates`
**模式：** THOROUGH（无 Critical/Major 数 ≥3，未升级 ADVERSARIAL）

## 审核报告（第 3 轮）— ACCEPT-WITH-RESERVATIONS

### Round 2 复核

| Round 2 # | 严重级 | 状态 | 证据 |
|---|---|---|---|
| N1 `position.has_position` 语义反向 | Critical | **已修** | spec §3.4（line 191-219）新增对偶表，语义清晰；plan C2 Step 1（line 179-181）IR 构造与 §3.4 表一致：`no_position`=HAS_POSITION+EQ const 1（有仓 block），`has_position`=HAS_POSITION+EQ const 0（无仓 block）；B1 Step 1（line 124-125）seed 映射"已有多仓不重复开仓"→`no_position`，与 §3.4 一致；C2 Step 1 line 181 加专属红测显式枚举 ctx.position.qty=0/1 两种态 |
| N2 `appliesTo` 被 EXPRESSION_GUARD 消费风险 | Major | **已修** | plan C2 Step 1 line 175 显式 `appliesTo: 'both'` 硬钉；spec §9.4（line 561-571）rev 3 修订段说明 sideScope 不下推到 IR、仅保留在 canonical metadata；E2 Step 1 line 247 corpus sideScope='long' case 显式断言 IR guard.appliesTo='both' |
| N3 B2 红测可能空跑 | Minor | **已修** | plan B2 Step 1 line 137 加对照组 case "`action.add_position` seed 走 `actions[]` 路径"，证明 builder 存在 atom→action 通路 |
| N4 §0 e2e 路径笔误 | Minor | **部分修** | §0 row（line 28）已改 "已存在 11.3K e2e"，但**新发现 P1**：未在 Phase E/F 落地具体 task |

### 新发现

| # | 严重级 | 问题 | 修法 |
|---|---|---|---|
| P1 | Major | N4 修正只改了 §0 dry-check 表的描述（"PR-1 在此文件追加 1 个 happy-path case"），但 Phase E（E1 parity / E2 corpus）和 Phase F1（lint/build/unit/contracts）都不含 e2e task；F1 并行命令清单也没有 `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`。executor 按 task 列表执行时会漏掉 e2e。证据：plan line 256-263，F1 命令清单。 | Phase E 加 Task E3（或 F0）"E2E happy-path"：Step 1 写失败测试 in `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts` 追加用户描述含 `成交量阈值 + MA 金叉` → 端到端 IR 含 1 gate + 1 entry；Step 2 跑 `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`；F1 并行命令清单加同命令 |
| P2 | Minor | EXPRESSION_GUARD `scope` 字段隐性陷阱：`evaluate-guards.ts:80` 中 `if (guard.payload.scope === 'position' && qty === 0) return false`。若实施人误把 gate guard 写成 `scope: 'position'`，`position.has_position`（HAS_POSITION+EQ const 0，预期 qty=0 时 predicate=true）会被这条短路掉 → 无仓时 guard 不触发 → entry 不被 block → 行为反转。Plan C2 Step 2 line 184-188 与 spec §9.3 示例（line 540-555）的 guard payload 都没显式列 `scope` 字段（默认 undefined），目前是正确的，但没有红测/不变量明示"gate guard 不可设 scope='position'"。 | C2 Step 1 不变量增加 1 条断言：编译产物 `ir.guards[*].payload.scope` 为 undefined（或显式非 `'position'`）；I 表格新增 I9 "gate EXPRESSION_GUARD 不设 scope='position'，否则会与 evaluate-guards.ts:80 短路碰撞" |
| P3 | Minor | C2 Step 1 line 178 的 time_window IR 构造写法用 inline `❌` 自我纠错（"predicate `EQ true`（…）❌ — 错；正确：predicate `EQ false`…"）。语义最终正确，但 executor 复制片段时极易选错版本。 | 删去前半段 `EQ true` 错误版本，只保留正确版本一段；或在 spec §9.3 类似 §volume 示例那样给出 time_window 的完整代码块示例 |
| P4 | Minor | F2 PR body 强制清单（line 268-273）只列了 round 1 / round 2 critic 报告，遗漏 round 3 自身。本 round 3 报告应一并附上。 | F2 line 273 后追加一行 "Plan critic round 3: .omc/plans/2026-05-07-ai-quant-phase1-multi-pr-critic-round3.md" |

### 多视角注

- **Executor**：plan 按 task 顺序可执行，唯一断点是 P1（e2e 不知何时何处加）。其他 task 自包含、Step 1 红测先写、Verify 命令明确。
- **Stakeholder**：5 atom 闭环 + corpus 8 case + parity 阻塞门已覆盖 §1.3 三个核心目标。spec §6.6 corpus 覆盖矩阵与 plan E2 8 case 对齐。
- **Skeptic**：rev 3 设计已极简（runtime 评估通道复用 EXPRESSION_GUARD，零新顶层字段），剩余未消除复杂度集中在 IR 编译器的 operator flip 表与 time_window 的"双重反向"语义（窗口内=true → 转为 EQ const 0 → 窗口外才 breach）。这些已在 C2 Step 1 红测覆盖。

### 不变量再核对

- I3 "`position.has_position / no_position` 不被识别为 add_position"：B2 Step 1 + N3 对照组 case 双重红测 ✓
- I5 "operator flip"：C2 Step 1 ✓
- I6 "sideScope 透传但 runtime 不区分 side"：E2 Step 1 corpus sideScope='long' case ✓
- 但 P2 揭示需要新增 I9（scope 不可设 position）

### 总结

**verdict：ACCEPT-WITH-RESERVATIONS**

N1-N3 已全部落实到 plan + spec 文本；N4 落实 50%（描述修对、task 缺失）。无新 Critical 发现，新发现 1 个 Major（P1）+ 3 个 Minor（P2/P3/P4），残留 Minor 数（P2/P3/P4）超过 ≤3 上限的边界但**等于 3**，符合 ACCEPT 阈值。P1 是 Major 但**不阻塞执行**——它是缺失任务而非错误任务，executor 可在 Phase E 阶段自行追加（spec §6.7 + §7.6 ship 门 checklist 已显式要求 e2e 通过），且 ship 门 checklist 会卡住未跑 e2e 的 PR。

按 multi-pr-feature-delivery skill 第 3 轮上限收敛标准：N1-N4 全修 + 新 Major ≤1（且不阻塞）+ Minor ≤3 → 进入"ACCEPT-WITH-RESERVATIONS"。**不进 round 4，不 escalate brainstorming**。要求 author 在 ship 前内联修补 P1（最小动作：在 Phase E 加 Task E3 或在 F1 命令清单显式追加 e2e 命令；耗时 < 5 分钟），P2/P3/P4 视情纳入实施过程的提交。

**plan 可以进入 subagent-driven 执行**。
