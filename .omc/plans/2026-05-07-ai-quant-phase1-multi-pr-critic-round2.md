# AI Quant Phase 1 Multi-PR — Critic 报告（第 2 轮）

**审计 plan：** `docs/superpowers/plans/2026-05-07-ai-quant-phase1-multi-pr.md`（rev 2）
**审计 spec：** `docs/superpowers/specs/2026-05-07-ai-quant-phase1-trigger-gates-design.md`（含 §9 修订段）
**Round 1 报告：** `.omc/plans/2026-05-07-ai-quant-phase1-multi-pr-critic-round1.md`
**模式：** THOROUGH → ADVERSARIAL（N1 Critical 触发）

---

## 审核报告（第 2 轮）— REJECT

### Round 1 复核

| Round 1 # | 严重级 | 状态 | 证据（file:line / plan 段） |
|---|---|---|---|
| C1 主循环落点 | Critical | 已修 | plan §0 dry-check 表第 19-20 行钉死 `signal-generator.service.ts:704-731` 与 `backtest-strategy-adapter.service.ts`；§9.5 "Adapters 零改动"；plan 不再提 `runner.ts` |
| C2 共享包 barrel | Critical | 已修 | plan §0 第 18 行与 §9.5 倒数第 4 行明确 `compiled-runtime.ts`（同名 .ts，不是子目录 index.ts）；D1/D2 task 都不再创建 `compiled-runtime/index.ts`；实测 `packages/shared/src/script-engine/compiled-runtime.ts` 7 行 export 与 plan 描述完全一致 |
| C3 e2e 路径 | Critical | 已修（但 §0 笔误） | rev2 不再在 task 中硬依赖 llm-strategy-codegen e2e（"Phase 1 不要求新 e2e 模块"），verify 不会卡。**笔误**：plan §0 第 28 行写"`apps/quantify/e2e/llm-strategy-codegen/` 不存在"，实际**存在**且含 `llm-strategy-codegen.e2e-spec.ts`（11.3K）。见 N4。 |
| C4 shared 测试命令 | Critical | 已修 | F1 第 258 行 `npx nx test shared`；D1 第 201 行 / D2 第 215 行用 `npx nx test shared --testPathPattern=...`；测试参考表 290-291 行；旧 `pnpm --filter @ai/shared test` 已全部清理 |
| C5 category vs kind | Critical | 已修 | spec §9.8 + plan §0 第 25 行；A2 task 第 80 行用 `category='trigger'`；spec §3 仍用 "kind: 'trigger'" 描述但 §9.8 显式声明二者同义，不重命名 |
| C6 关键不变量红测 | Critical | 已修 | plan "关键不变量与红测对照表"（305-316 行）I1-I8 一一映射到 task step；I2 按 rev2 改为"旧 IR byte-equal"；I4 三处落点（B1+B3+E2）；I3 落 B2 Step 1；I5 operator flip 落 C2 Step 1 |
| M1 executableTrigger 重构 | Major | 已修 | Task A0 独立列出（第 58-65 行） |
| M2 backtest adapter 定位 | Major | 已修 | §0 dry-check 表第 20 行钉死 `backtest-strategy-adapter.service.ts`；rev2 adapter 零改动，grep punt 取消 |
| M3 time_window 状态机 | Major | 部分修（可接受为 Minor） | B1 Step 1 第 122 行覆盖 "无时区→openSlot"；4 状态 `{tz?, windows?}` 只显式覆盖 2 状态；其余 2 状态由 contract `requiredParams` 自动 openSlot 兜底，不阻塞执行 |
| M4 PR-2 stub | Major | 已修 | 第 277 行只剩一段引用，无伪规划 |
| M5 parity 落点 | Major | 已修 | E1 第 222 行指定修改既有 `atomic-contract-backtest-runtime-parity.spec.ts` |
| M6 contracts 重生成 | Major | 已修 | F1 第 259 行 `dx build contracts --dev` 列入并行验证 |
| M7 错误传播一致性 | Major | 已修 | D2 Step 1 第 211 行显式断言 "返回 null 不抛"；I8 不变量表追加 |
| m1 substrate 命名映射 | Minor | 已修 | A1 第 67 行任务名列 A=volume / B=atr / C=time-window / D=position-state |
| m2 `gates: []` 默认 | Minor | N/A | rev2 已彻底取消 `gates` 顶层字段（spec §9.7），该 invariant 不再适用，I2 已替换为 "旧 IR byte-equal" |
| m3 不影响层声明 | Minor | 已修 | plan §0 第 33 行显式列出 ErrorCode/RBAC/Swagger/Seed/菜单/Migration/Auth |
| m4 jest CLI 透传 | Minor | 已修 | 与 C4 一并清理 |
| Missing #1 evalGates vs evaluateGuards | — | 已修 | spec §9.2 显式说明复用 evaluateGuards，不造 evalGates；plan 任务前提第 52 行重申 |
| Missing #2 旧 IR 兼容 | — | 已修 | C2 Step 1 第 179 行；I2 不变量 |
| Missing #3 live race | — | 未修（可接受 Minor） | 既有 `evaluate-guards.ts:206-208 readPositionQty` 在 qty 非 finite 时返回 0，兜底已存在 |
| Missing #4 observability | — | 未修（可接受 Minor） | spec §7.5 承诺扩 strategy decision log，plan 无 task；建议要么删 spec §7.5 要么单独 ticket |
| Missing #5 readiness 联动 | — | 已修 | A4 task 第 102-109 行 |
| Missing #6 Intl 缓存 | — | 已修 | D1 + I7 |

Round 1 17 条 + 6 Missing：实质已修 21 条，2 条降级 Minor 可接受，无未修的 Critical/Major。

### 新发现问题

| # | 严重级 | 问题 | 影响 | 建议 |
|---|---|---|---|---|
| N1 | **Critical** | **`position.has_position` 与 extractor 的语义映射自相矛盾**。plan B1 第 124 行：`"已有多仓不重复开仓" → position.has_position`（语义 = 已有仓位时阻止开仓）。plan C2 Step 1 第 177-178 行编译方向：`position.has_position → HAS_POSITION + EQ false 触发 guard（注："无仓位时才开仓"语义反）`、`position.no_position → HAS_POSITION + EQ true 触发 guard`。两处自相矛盾：按 C2 编译，has_position atom 编出来的 guard 在 `HAS_POSITION=false`（无仓）时触发 blockNewEntry，效果是"无仓时禁止开仓、有仓时允许重复开仓" —— 与 B1 的中文意图完全相反。 | 5 个 atom 中 2 个语义颠倒。corpus / parity 即使写对，extractor 与 IR compiler 仍互相打架。最坏情况：用户实仓系统按 "已有多仓不重复开仓" 配置后，runtime 反而在已有仓位时**继续重复开仓**，userspace 红线。 | 二选一对齐：(a) 把 B1 第 124 行 "已有多仓不重复开仓" 改映射到 `position.no_position`（语义="只在无仓时入场"），保持 C2 IR 编译表不变；(b) 翻转 C2 第 177-178 行 EQ 真值。建议 (a)，并在 spec §3.4 末尾加一句明确命名约定："`position.{X}` 中 X 描述 *允许 entry 通行的条件*（has_position = 需有仓才入场，少见；no_position = 需无仓才入场，常见）"。然后 B1 corpus 用例同步更名。 |
| N2 | **Major** | **EXPRESSION_GUARD 路径已经在消费 `appliesTo`，plan §9.4 "runtime 不区分 side" 的声称在该分支不成立**。`packages/shared/src/script-engine/compiled-runtime/evaluate-guards.ts:79-85` 中 `isGuardBreached` 对 EXPRESSION_GUARD 的处理：当 `qty !== 0` 时调 `doesGuardApplyToPositionSide(guard, qty)`，若 `appliesTo='long'` 且 qty<0（持有 short 仓位），直接 `return false`，guard 不触发 → blockNewEntry=false。这意味着 plan E2 corpus 第 244 行的断言"sideScope='long' 当前压制全部 entry"在 *存在反向仓位* 场景下失败。 | corpus assertion 写错会被合入 main，未来复用模板延续错误；live runtime 行为正确（既有 appliesTo 语义合理），但**plan 文档与代码不符**。 | C2 Step 2 第 185 行操作步骤明确：`guard.payload.appliesTo` 永远写 `'both'`（不直接消费 sideScope）；sideScope 透传放到 `ir.metadata.gateSideScope[guardId]` 等旁路字段，待 Phase 5 真正区分 side 时启用。E2 corpus 第 244 行用例改写：sideScope='long' 用 "无仓位 / 同向多仓位" 场景，避免反向仓位 edge case 把 plan 断言打脸。 |
| N3 | Minor | plan I3 + B2 Step 1 第 136 行声称 "`position.has_position` 不被识别为 add_position action"，但既有 `semantic-seed-state-builder` 是否有 atom→action 通用映射通路 plan 未举证。如该路径根本不存在，红测从未真正变红 → 防腐价值微弱化（"测试一个永远不会发生的事"）。 | TDD invariant 可能空跑。 | B2 Step 1 红测加前置说明：若 builder 不存在通用 atom→action 通路，断言改为 "mock 内部分支强制返回 add_position → builder 抛 invariant violation"，把 invariant 锁在合约而不是空 case。 |
| N4 | Minor | plan §0 第 28 行声明 "`apps/quantify/e2e/llm-strategy-codegen/` 不存在"——实测**存在**（含 `llm-strategy-codegen.e2e-spec.ts` 11.3K）。Round 1 C3 也基于该错误前提，实际目录早已存在。 | dry-check 表本应是真相记录，写错降低 reviewer 对其余条目的信任度。 | §0 第 28 行修订为 "存在 1 个 LLM wrapper case，Phase 1 不强制扩 happy-path（按需在 ship 阶段补）"。 |

### 处理决策

| # | 严重级 | 决策 | 理由 |
|---|---|---|---|
| N1 | Critical | 必修 | 语义颠倒会破坏 userspace（"已有多仓不重复开仓" 反而允许重复）。Realist Check：用户实仓配置后会被错杀或重复开仓；维持 Critical。 |
| N2 | Major | 必修 | `evaluate-guards.ts:83` 实际消费 `appliesTo`，plan 声称"不区分"是误读；corpus 断言会与 runtime 实际行为分歧。Realist Check：仅当用户存在反向仓位才暴露；mitigated by 多空切换罕见，但 plan 文档与代码不符不能合入。维持 Major。 |
| N3 | Minor | 修 | 防腐价值，不阻塞执行。 |
| N4 | Minor | 修 | 文档真相，不阻塞执行。 |
| M3 残留 2 状态 | Minor | 可接受 | contract requiredParams 自动 openSlot 兜底已足够。 |
| Missing #3 / #4 | Minor | 可接受 / 建议 | live race 由既有 readPositionQty 兜底；observability 建议 plan 头追加一句"§7.5 由后续 ticket 跟进"，或删除该 spec 承诺。 |

### 总结

Plan rev 2 的 Linus simplification 在结构上正确：复用 `evaluateGuards` + `runDecisionPrograms.ts:72-74` 的既有 `blockNewEntry` 短路，不新建 IR 顶层字段、不改 onBar 阶段。Round 1 的 17 条 + 6 Missing 已实质修复 21 条，余 2 条降级 Minor 可接受。

**但 rev 2 自身引入 2 条新风险（1 Critical + 1 Major），全部集中在 IR 编译方向与 sideScope 透传机制：**
1. **N1（Critical）** — `position.has_position` 在 B1 与 C2 之间的语义映射打架，会颠倒 userspace 行为。
2. **N2（Major）** — `appliesTo` 在 EXPRESSION_GUARD 路径已被既有代码消费，plan §9.4 声称"runtime 不区分 side" 不成立，corpus 断言会与代码分歧。

**判决：REJECT**。修复 N1 + N2 后再走 round 3 critic，预计 1 轮收敛 ACCEPT。**不需要回 brainstorming**：spec §9 主框架仍稳，问题局限在两处局部错误。

修订最小集（按优先级）：
1. plan §B1 第 124 行 "已有多仓不重复开仓" → 映射到 `position.no_position`；spec §3.4 末尾加命名约定一句。
2. plan §C2 Step 2 第 185 行：`guard.payload.appliesTo='both'` 固定；sideScope 走旁路字段；E2 sideScope='long' corpus 用例改写为"无仓位 / 同向仓位"场景。
3. plan §0 第 28 行修笔误（llm-strategy-codegen e2e 实存在）。
4. plan §B2 Step 1 红测前置说明（N3）。
5. （可选）plan 头追加一句 observability 由后续 ticket 跟进，或删除 spec §7.5 承诺。

---

## Verdict Justification

REJECT — 1 Critical + 1 Major 新发现。模式从 THOROUGH 升级到 ADVERSARIAL（N1 触发条件命中）。Realist Check 后均维持原级别：N1 直接破坏 userspace（用户实仓配置反向执行）、N2 文档与代码分歧不可合入。

Self-Audit：N1/N2 均有具体 file:line + plan 行号证据（`evaluate-guards.ts:79-85` / plan B1 第 124 行 / plan C2 第 177-178 行 / plan §9.4 第 555 行）；HIGH confidence；无 Open Questions 转移。

未发现的潜在风险（已检查、无问题）：
- canonical-serialize 对新 series kind payload `{kind:'HAS_POSITION', side?}` / `{kind:'IN_TIME_WINDOW', timezone, windows}` 无需特殊映射 —— `canonical-serialize.ts` 是泛型递归（Object.entries + sort），新 payload 自动覆盖。**无 finding**。
- operator flip 表 `GT→LTE / GTE→LT / LT→GTE / LTE→GT / EQ→via NOT predicate`：4 个数值比较算子翻转完整，EQ 走 NOT predicate（已在 evaluate-expr-pool.ts:148-149 实现）。**无 finding**。
- `compiled-runtime.ts` barrel 不需要为 timezone-clock 加 re-export（D1 timezone-clock 是内部 helper，被 evaluate-expr-pool 内部调用，不对外）。plan §9.5 倒数第 4 行写"如需对外"留余地，正确。**无 finding**。

