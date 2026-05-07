# AI Quant Phase 1 Multi-PR 实施计划 — Critic 报告（第 1 轮）

**待审计划：** `docs/superpowers/plans/2026-05-07-ai-quant-phase1-multi-pr.md`
**设计参考：** `docs/superpowers/specs/2026-05-07-ai-quant-phase1-trigger-gates-design.md`
**Issue：** AlphaNet7ed/towering-wombat#984
**分支：** `feat/984-phase1-trigger-gates`
**Critic 模式：** ADVERSARIAL（触发条件：发现 ≥1 Critical + 多个 Major + 系统性虚指文件路径）

---

## 概要：Critical 6 / Major 7 / Minor 4

**总判决：REJECT — 计划须重写后再 critic。**

直接事实：计划中多处文件路径在仓库中不存在或名称错误，verify 命令未跑过 dry check 就照搬，而几个最关键的不变量（onBar 顺序、`gates: []` 反序列化默认、`evalGates` 在 exit 之前）只在风险表里口头提到，没有落到 task 步骤的失败测试里。这不是修一两条就过的问题，是计划与代码脱节。

---

## Critical 问题

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| C1 | **`packages/shared/src/script-engine/compiled-runtime/runner.ts` 主循环不存在**。计划 Task D3 `Modify` 该文件并写"onBar 顺序：ingest → evalGates → exit/risk → entry → emit"。仓库 `compiled-runtime/` 实际只有 `evaluate-expr-pool.ts / evaluate-guards.ts / evaluate-risk-predicates.ts / run-decision-programs.ts / run-order-programs.ts / build-compiled-manifest.ts / canonical-serialize.ts`，**没有 `runner.ts`，没有任何文件实现 onBar 主循环**。onBar 的实际编排发生在消费方 `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts:704-731`，那里直接调 `evaluateGuards` / `runDecisionPrograms`。 | 计划"主循环顺序"无处可落；执行人会要么乱建一个不被消费的 `runner.ts`，要么改错文件，evalGates 永远不会被调用，gate 通道实际不工作。 | 先在 plan 里定义清楚 onBar 编排的"真正落点"是 (a) 在 `compiled-runtime` 新建一个 onBar 编排器并让 `signal-generator.service.ts` 改成调它，还是 (b) 直接在 `signal-generator.service.ts` 加 `evalGates` 调用。无论哪种都要列入 D3 task 文件清单，并且把 `backtesting` 模块同样的入口加进去（parity 必须保证两边对称）。 |
| C2 | **`packages/shared/src/script-engine/compiled-runtime/index.ts` 不存在**。Task D4 `Modify packages/shared/src/script-engine/compiled-runtime/index.ts` 导出 `evalGates`。compiled-runtime 子目录无 barrel；现有导出在 `packages/shared/src/script-engine/compiled-runtime.ts`（注意是同名 `.ts` 文件，不是 `compiled-runtime/index.ts`），所有消费方走 `from '@ai/shared/script-engine/compiled-runtime'`。`@ai/shared` 的 `package.json` exports 也只声明 `./script-engine/*` 映射到 `dist/script-engine/*`，没有为 `compiled-runtime/index` 做单独 export。 | 计划照写会导致 (a) 创建 `compiled-runtime/index.ts` 后被路径解析器优先于 `compiled-runtime.ts` 选中，旧的所有 named export（`evaluateExprPool / evaluateGuards / runDecisionPrograms / runOrderPrograms` 等）丢失，编译方面爆雷；(b) 或文件创建了但消费方不会读到，evalGates 不可见。 | 把 D4 task 改为：`Modify packages/shared/src/script-engine/compiled-runtime.ts`，在原有 7 行 export 末尾追加新 helper / evalGates 的 re-export。删除"创建子目录 index.ts"的写法。 |
| C3 | **`apps/quantify/e2e/llm-strategy-codegen/` 目录不存在**。Task G1 与"测试运行参考"表格都引用 `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`。仓库 `apps/quantify/e2e/` 下只有 `account-strategy-view/ ai/ backtesting/ exchange-accounts/ helpers/ market-data/ strategy-signals/ strategy-subscriptions/ trading/ cache/ fixtures/ health/`，**没有 llm-strategy-codegen e2e**。最相关的入口是 `apps/quantify/e2e/ai/ai.e2e-spec.ts`（仅 2.6K，不一定覆盖 codegen 全链路）。 | G1 当前写法无法直接 verify；执行人要么硬造一个空 e2e 凑路径，要么改 ruler 强制每次 happy-path 都跑超大模块 e2e（成本爆表）。Phase 1 PR-1 ship 门 checklist 也会卡死。 | 把 G1 改为：(1) 优先复用 `apps/quantify/e2e/ai/ai.e2e-spec.ts` 增加一条 happy-path 用例；(2) 如必须新建，明确 `apps/quantify/e2e/llm-strategy-codegen/codegen-gate-atoms.e2e-spec.ts` 路径并加入 fixture / setup-e2e 接入步骤。`spec §6.7` 条目同步修订。 |
| C4 | **`pnpm --filter @ai/shared test` 不可执行**（命令未 dry check 即写入 plan）。`packages/shared/package.json` 的 `scripts` 仅有 `build` 与 `dev`，**没有 `test` 脚本**。`@ai/shared` 单测靠的是 Nx 层 `npx nx test shared`（`packages/shared/project.json` 里有 `test` target；根 `package.json` 的 `test` 走 `nx run-many --target=test --all`）。计划 Task D1 / D2 / D4 的 `Verify` 步骤直接照搬 `pnpm --filter @ai/shared test/build` 与 `pnpm --filter @ai/shared test -- helpers`。 | TDD 闭环的"红 → 绿"步骤跑不起来，CI 与本地都会爆 `npm ERR! Missing script: "test"`；执行人会绕路改命令、绕过 plan，造成不可追溯的偏离。 | 全表 `Verify` 改为 `npx nx test shared --testPathPattern=<...>` 或 `npx nx test shared -t '<name>'`；plan "测试运行参考" 表格 `Shared unit` 行同步修订。如果想保留 pnpm 风格，先在 `packages/shared/package.json` 加 `"test": "jest"` 脚本作为 Task D0（但与现有 Nx 集成需校验，建议直接用 nx）。 |
| C5 | **`kind` 与 `category` 命名不一致，spec / plan 反复使用 `kind=trigger`，registry 实际用 `category`**。`semantic-atom-registry.service.ts:222` 函数 `executableTrigger` 返回 `category: 'trigger'`，`unsupported(key, category, ...)` 第二参数也叫 `category`。spec §3 全程写 `kind: 'trigger'`、§7.4 风险也写 `kind=trigger, phase=gate`，plan §A1/A2/A3 直接照搬。`SemanticContractKind` 在 `semantic-atom-support.ts:47` 是另一个枚举，作用域不同。 | 执行人 (a) 在 registry 写 `kind: 'trigger'` → TypeScript 类型不匹配；(b) 误改 `category → kind` 全局 → 大爆炸。registry spec 断言 `kind=trigger` 直接 false。 | plan A2/A3 task 步骤里把所有 `kind=trigger` 替换成 `category='trigger'`；如果团队真想改名（contract kind vs registry category 同名易混），要单开 Task A0 `rename category to kind` 并独立 review，绝不在本 PR 里偷塞重命名。 |
| C6 | **关键不变量未约束到 task 失败测试**：(a) onBar 评估顺序"step 2 在 step 3/4 之前"；(b) `gates: []` 反序列化默认；(c) `time_window` 缺 tz 不能默认 UTC；(d) `position.has_position` 不被识别为 `add_position` action。plan §"主要风险"段把这些写出来了，但只有 D3 Step 1 的"gate=false 且已有仓位 → exit 仍能触发"算挂上去，其余三条 invariant **没有任何 task step 强制写一个会红的失败测试**。 | TDD 计划失去防腐能力；这些 invariant 任意一条破坏，runtime 就把已有用户仓位错杀或开错仓位，**直接是 userspace 破坏**（Linus 原则的红线）。 | 在每个相应 task 的 Step 1 列出明确的失败测试用例：B3/C1 加 `gates 字段缺失反序列化默认 []` 测试；B1/B3 加 `time_window 缺 timezone → openSlot, never UTC default`；B3 加 `position.has_position 不投影成 add_position action` 测试；D3 Step 1 显式补 `gates 字段 undefined → 旧路径 byte-equal` 测试。每条 invariant 必须有专属红测，spec §7.4 与 plan task step 一一对应表必须写出来。 |

---

## Major 问题

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| M1 | **`executableTrigger` 重构未单列任务**。Task A2 内嵌"重构 `executableTrigger` 接受可选 `substrateFactory` 参数，默认 `baseExecutableSubstrate`"。`semantic-atom-registry.service.ts` 当前 `executableTrigger / executableAction / executableRisk` 都硬写 `contractSubstrate: baseExecutableSubstrate()`，重构会牵动 50+ 个调用点的 substrate 不变性断言（registry spec、invariant spec）。这种基础设施改动不能塞进 atom 升级 task 里。 | A2 一旦失败，5 个 atom 都阻塞；review diff 里 atom 改动与 helper 重构混杂，难以独立回滚。 | 拆 Task A0：`refactor(ai-quant): make executableTrigger accept optional substrate factory`，独立 commit + 独立 verify（既有 50+ atom 仍 byte-equal substrate）。然后才有 A2。 |
| M2 | **Backtest adapter 实际位置未在 plan 里 grep 出来**。Task E1 写 "`Files: Modify backtest adapter（quantify 内，定位 in 实施开头 grep）`"。这是 plan critic 不能接受的 punt — `apps/quantify/src/modules/backtesting/` 与 `strategy-signals/services/signal-generator.service.ts` 都是候选。plan 必须在投入执行前定位完毕。signal-generator.service.ts:704-731 已确认是 live 路径；backtest 路径需要确认是 `apps/quantify/src/modules/backtesting/services/` 中某个 runner，否则 parity 必失败。 | 执行人误改成只动 live 不动 backtest，Layer 5 parity test 全红；或写两份 evalGates 调用点导致 byte-equal 漏判。 | 在 plan 头 File Structure 里把 backtest adapter 与 live signal adapter 的精确文件名钉死，给出现有 `runDecisionPrograms` / `evaluateGuards` 的调用点 `file:line` 列表，要求 PR-1 task E1/E2 在两边对称插入 evalGates 并通过同一接口。 |
| M3 | **`time_window` "缺 tz → openSlot" 与 spec 段 §3.3 `requiredParams: ['timezone', 'windows']` 矛盾**。`requiredParams` 全列必填表示缺任何一个就要 openSlot；spec §1.1 又把 `time_window` 整体标 `supported_requires_slot`，含义模糊：是默认 requires_slot 直到 timezone+windows 都齐？还是 timezone 缺时进 openSlot、其余 supported_executable？plan B1/B3/F1 没有明确分支语义。 | extractor 实现选错分支：要么所有 time_window 都进 requires_slot（用户填了 timezone 也不进 executable），要么缺 windows 时静默走 default 致 backtest 错位。 | spec §3.3 与 plan B1 step 1 之间补一张状态机：`{tz?, windows?}` 4 状态 → 期望 supportStatus / openSlots 列表。每条状态写一个 corpus case。 |
| M4 | **PR-2 完全是 stub，但 plan 已假设两 PR 串行节奏**。plan 头部 PR 拓扑表第二行说"#PR-2 依赖 PR-1"，理由是"两者都改 `semantic-atom-registry.service.ts / atom-coverage-golden-cases.ts / canonical-spec-v2-ir-compiler.service.ts`，串行避免 rebase 冲突"。这其实只是文件路径冲突防护，不是数据流硬依赖。multi-pr-feature-delivery skill 说"硬依赖才串行，否则可并行"。本计划应当明示：PR-2 的 brainstorming 必须在 PR-1 ship 后才启动，PR-2 的 task 计划另起独立 plan 文件，本文件不予扩写。当前 stub 段（plan 末尾"Stub 范围"）易被误读成"已规划完毕只欠执行"。 | review 时容易合并 PR-1 后立即起 PR-2，未走 brainstorming → 计划质量塌方。 | 把 PR-2 段简化为一段话：`PR-2 待 PR-1 ship 后另起 brainstorming + 独立 plan 文件，本计划只覆盖 PR-1`；删掉"Stub 范围"伪规划。 |
| M5 | **Layer 5 parity 文件命名/落点不明**。Plan §File Structure 写 `apps/quantify/.../__tests__/runtime-parity-gates.spec.ts`，仓库已有 `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`。是新增独立文件，还是在既有 parity 文件里增 case？plan 没说清。 | 重复 parity infra 浪费维护成本；或反过来散落到独立文件后 invariant 检查不一致。 | E3 task 改为：`Modify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`，在文件内 `describe('phase-1 gate parity', ...)` 段追加 5 组 fixture。 |
| M6 | **api-contracts / contracts 重生成评估缺失**。plan 末尾"测试运行参考"提到 "Backend build（如 contracts 受影响）"，但 PR-1 改动包含新增 IR 字段 `gates`、新增 5 atom 类型，是否流入 `packages/api-contracts/src/generated/quantify.ts`？没有任何 task 步骤检查 swagger / quantify OpenAPI 导出是否变化。如果 codegen-conversation HTTP 接口暴露了 spec 结构，contract 重新生成是必须步骤。 | PR-1 merge 后前端类型与后端不一致，admin / front 编译挂掉。 | 在 Phase G 加 Task G0：`检查 quantify swagger 是否变化 → 必要时 dx build contracts --dev`，明确成 verify 步骤而非"如果"。 |
| M7 | **realist 检查 — `evalGates` 抛错策略与 `evaluate-risk-predicates.ts` 现有约定可能冲突**。Spec §5.5 写 "predicate 抛错 → 视为 false → 关 entry"。但既有 `evaluate-expr-pool.ts` / `evaluate-guards.ts` 是否同样 try/catch？如果不是，Layer 4 测试 "predicate 抛错" 在 evalGates 内被吞，但底层 evaluator 抛到上层会先杀进程。 | runtime 异常半吞半抛，行为不确定。 | D2 task step 1 要求显式断言：(a) `predicate evaluator throw → evalGates 返回 false 不冒泡`；(b) 与 `evaluateGuards` / `evaluateRiskPredicates` 的错误传播一致性 case（必要时让 evalGates 调用 evaluator 的同款 wrapper）。 |

---

## Minor 问题

| # | 问题 | 影响 | 建议 |
|---|------|------|------|
| m1 | plan 第 87-90 行 4 个 substrate 工厂的命名 (`volumeGateSubstrate / atrGateSubstrate / timeWindowGateSubstrate / positionGateSubstrate`) 与 spec §2.3 模板 A/B/C/D 没明确映射；review 时易迷失。 | 可读性。 | A2 task step 2 加一行映射表：A=volumeGateSubstrate / B=atrGateSubstrate / C=timeWindowGateSubstrate / D=positionGateSubstrate。 |
| m2 | plan 风险表写 "IR builder 强制写出 `gates: []`；runtime `?? []` 容错"，但没指明哪个 task 实施这两步；C1/C2 要显式落到 step 2。 | 防腐弱化。 | C1 step 2 增："builder 输出 spec.gates 默认 `[]` 而非 undefined"。C2 step 2 增："runtime 入口 `ir.gates ?? []` 容错"。 |
| m3 | "ErrorCode / RBAC / Swagger / api-contracts / Seed / 菜单注册" 关联模块的影响评估在 plan 中只有 contracts 一项被边缘提到（M6），其他 5 项零提及。Phase 1 是否真的零影响？（实际 RBAC/菜单/Seed 应该真零影响，因为只改 codegen 内部 schema；ErrorCode 也无新错误码 — issue 本身也不要求；但 plan 没有 explicitly say "确认零影响"）。 | 审计追溯不完整。 | plan 头部加一段 `不影响层（已确认）：ErrorCode / RBAC / Swagger / Seed / 菜单注册 / 数据库 schema / Prisma migration`，每条一行 explicit 写出。 |
| m4 | plan 行 174 `pnpm --filter @ai/shared test -- helpers` — "-- helpers" 形式是 jest CLI 透传，前提是 `test` script 是 `jest`。若按 C4 修订改为 nx，命令应当是 `npx nx test shared --testPathPattern=helpers`。 | 同 C4。 | 与 C4 修订一并改写。 |

---

## What's Missing（计划中未覆盖的关键缺口）

- **`evalGates` 与既有 `evaluateGuards` 的关系未澄清**。`evaluateGuards` 已经在 compiled-runtime 实现 guard 评估；新增 `evalGates` 是另起一条通道还是合并？plan 默认假设新增独立函数，但 spec / plan 没说为什么不复用 `evaluateGuards`。Linus 风格：能不能不写新函数。
- **回滚到旧 IR 的兼容路径**。旧 strategy 已落库的 canonical IR 没有 `gates` 字段；新 runtime 反序列化时如何 default？plan §"主要风险" 提到，但 Task 步骤无显式数据兼容测试（"取一份 PR 之前的 IR JSON，用新 runtime 跑能否 byte-equal"）。
- **Live race condition**：spec §5.5 说 `position_state` 读取失败 fail-closed，但 plan 没有 Task 落点。需要在 D3 / E2 加测试。
- **observability**：spec §7.5 承诺扩 strategy decision log，plan 无任何 task 实施这部分。要么删掉 spec 这条，要么加一个 Task。
- **Phase 0 readiness 联动**：spec §4 说 "Phase 0 readiness fail-closed 自动适用"，但若 5 个 atom 升级后 readiness 服务的 unsupported 兜底替换链 (`semantic-contract-readiness.service.ts`) 内部判断逻辑被影响（这文件 25.7K，有大量分支），plan 没有 task 检查。建议加一个针对 `semantic-contract-readiness.service.spec.ts` 的回归测试 task。
- **time_window 高频 K 线性能**：spec §5.6 说零分配，但 `Intl.DateTimeFormat` 每次 new 实例非零分配。plan D1 `timezone-clock.ts` 没有要求 cache `Intl.DateTimeFormat` 实例的步骤。
- **gate 与现有 SignalGenerator 服务的冲突**：`signal-generator.service.ts:704-731` 是 live 入口；如何插入 evalGates，是否会改变 emission timing，plan 没有任务列。这与 C1 重叠。

---

## Ambiguity Risks

- `plan §"Step 1：写失败测试（type-focused）"`（行 70）→ A：仅类型断言文件（`expectType<...>`）；B：runtime spec 断言对象 shape。计划只说"声明 `GateNode` 实例"暗示 A，但 jest spec 文件不是 type-only。
  - 风险：执行人写运行时 jest spec 但内容只是空构造，没有 fail-first 价值。
- `plan §F1 case 3 "1 mix supported+unsupported（gate + unsupported entry → unsupported_unknown 优先）"` → A：整个策略 route=unsupported_unknown；B：gate 部分 route=executable，entry 部分 route=unsupported。spec §6.6 写 "unsupported_unknown 优先"，但优先是按 atom 还是按整策略？
  - 风险：corpus 断言写错，正确 strategy 被误判 reject。
- `plan §A2 "新增 supportedRequiresSlotTrigger ... 参考已有 supportedRequiresSlotRisk"` → 实际 registry 只有 `supportedRequiresSlotRisk`（行 261）。计划假设需新建 `supportedRequiresSlotTrigger`。但是否所有 trigger 都该走它，还是仅 time_window？
  - 风险：要么写一个泛型 helper 一次到位，要么散写一次性逻辑。需要 plan 决策。

---

## Multi-Perspective Notes

- **Executor 视角**：`backtest adapter（quantify 内，定位 in 实施开头 grep）` 是 punt；executor 启动会立即问回。`runner.ts 或同等` 也是。`__tests__` 目录指引前后不一致（plan 用 `apps/quantify/.../__tests__/`，仓库实际是 `services/__tests__/`，pretty obvious 但还是该写绝对相对路径）。
- **Stakeholder 视角**：Phase 1 "执行闭环" 对外承诺 5 atom 可跑；如果 Layer 5 parity test 不阻塞 merge（plan 没 explicit 写"任一 parity fail 不许 merge"），就会有 live 与 backtest 偷偷分歧的 case 漏过。
- **Skeptic 视角**：plan 用 "不引入 feature flag (YAGNI)" 自我说服。但加入新 onBar 步骤是 hot path 改动，没有 build-time / 配置开关意味着回滚只剩 `git revert`。如果 PR ship 进 main 半小时后 live 出问题，30 分钟回滚窗口够吗？建议加一个 `gate-evaluator.ts` 顶层 const `GATE_EVAL_ENABLED = true` 编译期开关（不算运行时 flag），出事 1 行 revert 即关。

---

## 处理决策（逐条）

| # | 严重级 | 决策 | 理由 |
|---|--------|------|------|
| C1 | Critical | 修 | 主循环落点不存在，必修。 |
| C2 | Critical | 修 | barrel 路径错误，照写会破坏现有 export。 |
| C3 | Critical | 修 | e2e 路径不存在，verify 跑不通。 |
| C4 | Critical | 修 | `pnpm --filter @ai/shared test` 未声明，命令会直接 fail。 |
| C5 | Critical | 修 | 命名一致性是 type 安全前提，必修。 |
| C6 | Critical | 修 | 关键 invariant 没绑到红测，等于没防护。 |
| M1 | Major | 修 | helper 重构必须独立 task。 |
| M2 | Major | 修 | backtest adapter 路径必须 plan 阶段定位完毕。 |
| M3 | Major | 修 | time_window 状态机必须明确。 |
| M4 | Major | 修 | PR-2 stub 误导，删 stub 段。 |
| M5 | Major | 修 | parity 测试落点统一。 |
| M6 | Major | 修 | contracts 重生成检查必加。 |
| M7 | Major | 修 | 错误传播一致性必测。 |
| m1 | Minor | 修 | 一行表格，零成本。 |
| m2 | Minor | 修 | 落到 task step 即可。 |
| m3 | Minor | 修 | 加一段 explicit 不影响层声明。 |
| m4 | Minor | 修 | 与 C4 一并改写。 |

---

## 验证流水线建议（lint / build / test / migration grid）

| Stage | 命令 | 备注 |
|-------|------|------|
| Lint | `dx lint` | 全部 task 完成后必跑 |
| Quantify build | `dx build quantify --dev` | 修改 IR 类型后必跑 |
| Shared build | `npx nx build shared` | 替换 `pnpm --filter @ai/shared build`（C4） |
| Shared unit | `npx nx test shared` 或 `npx nx test shared --testPathPattern=<file>` | 替换 `pnpm --filter @ai/shared test`（C4） |
| Quantify unit（按文件） | `dx test unit quantify -- --testPathPattern=semantic-atom-registry` | 验证 `dx test unit quantify -t '<name>'` 实际是 `npx nx test quantify -t '<name>'`，jest CLI `-t` 是 `--testNamePattern` |
| Quantify unit（按 case 名） | `dx test unit quantify -t 'phase-1 gate'` | 同上 |
| Quantify e2e | `dx test e2e quantify apps/quantify/e2e/ai/ai.e2e-spec.ts` | 修订 G1 后的实际路径 |
| Contracts 重生成（M6 触发） | `dx build contracts --dev` 与必要时 `dx build backend --dev` | 流入 `packages/api-contracts` |
| Migration | 无（本 PR 零 schema 变更） | 显式声明在 plan 头部 |

---

## 总结

本计划处于 **REJECT** 状态，需要 planner 重写后再走 critic 第二轮。主要是：

1. 多处文件路径与命令在仓库中不存在或与现实不一致（C1/C2/C3/C4），表明 planner 没在执行前 dry check 仓库；这违反"verify before assertion"。
2. C5 `kind` vs `category` 是类型层硬冲突，不修执行人会立即卡住。
3. C6 几条 userspace 不变量没绑红测，是 multi-pr-feature-delivery skill 强调的"硬基础"层失守。
4. 不需要 escalate 回 brainstorming —— 设计 spec 本身的不变量与拓扑大体合理，问题全在 plan 落地阶段；planner 修订后 1 轮 critic 再走 1 次即可（≤3 轮收敛仍然可行）。

**给 planner 的修订指引（精简）：**
- 在 plan 头补一段 "已 dry-check 的现状"，列：(a) 主循环真实位置（`signal-generator.service.ts:704-731`、`backtesting/...`）；(b) 共享包导出真实文件（`compiled-runtime.ts` 而非 `compiled-runtime/index.ts`）；(c) e2e 真实路径（`apps/quantify/e2e/ai/ai.e2e-spec.ts`）；(d) `dx test`/`nx test` 命令真实形式。
- 把 `kind` → `category` 全改一遍；spec §3 同步修订或在 plan 显式注明"spec 用 kind 描述，registry 字段名 category，二者同义"。
- 拆 Task A0 (executableTrigger 重构) + Task G0 (contracts 重生成检查)。
- 4 条 invariant（onBar 顺序 / `gates: []` 默认 / `time_window` 不默认 UTC / `position.has_position` ≠ add_position）每条挂一个 explicit 红测 task step。
- 删 PR-2 stub，明示 PR-2 另起 plan。
- 删除"backtest adapter（定位 in 实施开头 grep）"punt，直接钉死文件路径。

---

*Critic 模式：ADVERSARIAL（C1 触发后激活）*
*Realist Check：6 个 Critical 全部维持原级别 — 都直接阻塞执行或破坏 byte-equal 兼容；无一可降级。*
*Self-Audit：所有 Critical/Major 均有 file:line 或行号引用证据；Open Questions 留空。*

