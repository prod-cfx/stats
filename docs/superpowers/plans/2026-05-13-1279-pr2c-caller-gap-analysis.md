# Issue #1279 PR2c — caller 清单 + dispatcher gap 分析报告

> 范围：legacy `SemanticSeedExtractorService` (6611 行) + 其上游帮手
> `SemanticEventFrameParserService` (175 行) 的全网 caller 清单 + 与
> `GenericSeedDispatcher` (PR2a/2b 已落地的 pure-registry 路线) 的能力差距
> 矩阵；本报告只做摸底，**不动任何 production / spec 代码**。
>
> 数据基线：origin/main `50101a138`（PR2b 已 merge，PR2a `pure-registry-driven
> dispatcher + AC-13 ESLint enforce` 已 ship）。

---

## 0. 数字摸底（先把规模钉死）

| 指标 | 数值 |
| --- | --- |
| `SemanticSeedExtractorService` 文件行数 | 6611 |
| `SemanticEventFrameParserService` 文件行数 | 175 |
| `codegen-conversation.service.ts` 行数 | 9496 |
| `semantic-open-slot-answer-resolver.service.ts` 行数 | 1040 |
| `SemanticSeedExtractorService` / `semantic-seed-extractor` 命中文件总数 | 51 |
| `SemanticEventFrameParser` / `semantic-event-frame-parser` 命中文件总数 | 6（其中 4 个与 seed extractor 重叠：module / module.spec / projector.spec / extractor 自身；仅 parser 独立 caller 为 parser 自身 + parser.spec 共 2 个） |
| 去重后 caller 文件总数 | 47（51 + 6 − 10 重叠 = 47；其中 6 重叠来自 parser 与 extractor 共享文件，4 重叠来自 atom-contract types/parser/extractor 同模块跨命名命中） |
| 其中 production 文件 | 4（含 legacy extractor 自身 + parser 自身） |
| 其中 module / module spec | 2 |
| 其中 spec 文件（含 utterance corpus spec） | 44（按断言形态分桶：S1=2 + S2=6 + S3=14 + S4=20 + S5=2） |
| 其中 ESLint allowlist 条目 | 1（`eslint.config.js`） |
| 其中 atom-contract types 引用（类型别名跨用） | 2 |
| 其中文档（`apps/quantify/docs/phase3-coverage-report.md`） | 1 |

> 47 = 4 production + 2 module + 44 spec + 1 eslint + 2 types + 1 doc − 7
> 重叠（types 与 production 同模块、parser 与 extractor 同模块、parser.spec 同时被两轮 grep 命中）。简化口径：
> **3 个 production caller + 44 spec + 1 module wiring + 1 eslint allowlist**
> 是必须治理的核心面，types/doc 一次性更新即可。

---

## 1. caller 清单（按类型分类）

### 1.1 Production caller（必须切换到 dispatcher 才能删 legacy）

| 文件 | 行数 | 调用点（行号） | 形态 | 紧耦合点 |
| --- | --- | --- | --- | --- |
| `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts` | 9496 | L90 import；L238 ctor `default-new` 注入；私有方法 `extractSemanticPatchFromMessage` 定义 L9121-L9126，内部 **L9122** `this.semanticSeedExtractor.extract(message)`；该私有方法被 **7 个上游调用站**共用：L267（`createSession` 的 `dto.initialMessage`）/ L1513（普通消息流 `dto.message`）/ L7409（`normalized` 输入路径）/ L9041 / L9075 / L9092 / L9107（多 fallback 分支） | `extractor.extract(message) → CodegenSemanticPatch`；显式消费 `patch.contextSlots / triggers / actions / risk / position` 5 顶层字段做 truthy 过滤；**隐式消费**字段见 §2.2 | 顶层 5 字段（truthy 过滤）+ 隐式 `patch.symbols / patch.timeframes / patch.riskRules.*`（被 `mergePlannerSemanticPatch` / `detectPatchConflicts` L9403-L9413 消费）。c4 切换需同时覆盖 7 caller path（initial / 普通会话 / normalized / 4 fallback 分支），不是单一 transport_failure 兜底场景。 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts` | 1040 | L22 import；L85 ctor `default-new`；**L112** `this.seedExtractor.extract(input.message)` | `extractor.extract(message)` 结果直接喂给 `fulfillSemanticFragment(currentState, patch, symbolResolver)` | `fulfillSemanticFragment` 是 patch-shape 消费者，不是 SemanticSeed-shape 消费者；接口已经是 patch-level，迁移最小风险。 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts` | 6611 | 自身 | legacy 实体本体；6 ctor 子依赖（PositionSizingContractService / EventFrameParser / EventFrameProjector / SymbolResolver / NLGateway / FrameNormalizer） | 一旦上述 2 个 production caller 切换完毕，本文件可由 c-final 物理删 |
| `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-parser.service.ts` | 175 | 自身 | 仅被 `semantic-seed-extractor.service.ts` 与对应 spec / projector spec 引用；非独立 caller | 与 seed extractor 同生命周期，c-final 一并删 |

### 1.2 DI 模块 wiring

| 文件 | 行号 | 内容 |
| --- | --- | --- |
| `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.ts` | L39, L46 import；L79, L81 `providers` 数组 | `SemanticEventFrameParserService` + `SemanticSeedExtractorService` 注册 |
| `apps/quantify/src/modules/llm-strategy-codegen/llm-strategy-codegen.module.spec.ts` | — | 模块组装 spec（断言 providers 列表） |

### 1.3 ESLint allowlist

| 文件 | 行号 | 内容 |
| --- | --- | --- |
| `eslint.config.js` | L215 | `semantic-seed-extractor.service.ts` 出现在合法 import allowlist；删除时同步删条目 |

### 1.4 Atom contract types（类型旁路引用）

| 文件 | 用途 |
| --- | --- |
| `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-surface.types.ts` | 类型别名 |
| `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-types.ts` | 类型别名 |

> 这两个文件只用 legacy 模块导出的 *type* 名（不引行为），评估为机械改名即可。

### 1.5 Spec caller（41 个文件，按断言形态分桶）

> 数据来源：`grep -c semantic-seed-extractor` per file；样本头部已抽样确认。

#### Bucket S1 — dispatcher-aligned（已是 dispatcher 自洽契约，零迁移成本）

| 文件 | 命中数 | 特征 |
| --- | --- | --- |
| `__tests__/dispatcher-self-baseline.spec.ts` | 1（仅注释） | 已切 `GenericSeedDispatcher`；引用仅在 docstring |
| `__tests__/dispatcher-semantic-equivalence.spec.ts` | 1（仅注释） | 同上 |

**策略**：删 legacy 时同步删两段 docstring 注解；spec 本体不动。

#### Bucket S2 — golden-corpus / phase3 / utterance-corpus（必须重写为 dispatcher 契约）

| 文件 | 命中数 | 断言形态 |
| --- | --- | --- |
| `__tests__/semantic-gateway-golden-corpus.spec.ts` | **52** | 直接 `new SemanticSeedExtractorService()` + 喂给 `SemanticSeedStateBuilderService.build()`，断言 `SemanticState` projection 形态 |
| `__tests__/atom-coverage-golden-corpus.spec.ts` | 2 | 同上 pattern |
| `__tests__/atom-coverage-contract.spec.ts` | 3 | utterance corpus → seed extractor → atom 覆盖率断言 |
| `nl-gateway/utterance-corpus/utterance-corpus.spec.ts` | 2（648 行 fixture 驱动 spec：L13 import + L79 `new SemanticSeedExtractorService()`） | 同 atom-coverage 同类 |
| `__tests__/phase3-integration-corpus.spec.ts` | 3 | 大语料 integration |
| `__tests__/semantic-only-strategy-regression.spec.ts` | 4 | regression matrix |

**策略**：重写为 `GenericSeedDispatcher.dispatch()` 输出断言。`semantic-gateway-golden-corpus.spec.ts` 因 855+ 行 + extractor 与 state-builder 链路深度耦合，拆为单独子任务。

#### Bucket S3 — parity spec（atom-by-atom 平台契约，可批量迁移）

| 文件 | 命中数 |
| --- | --- |
| `__tests__/strategy-time-window.parity.spec.ts` | 7 |
| `__tests__/volatility-atr-threshold.parity.spec.ts` | 6 |
| `__tests__/volume-threshold.parity.spec.ts` | 6 |
| `__tests__/partial-take-profit.parity.spec.ts` | 8 |
| `__tests__/divergence.parity.spec.ts` | 2 |
| `__tests__/dca-schedule.parity.spec.ts` | 3 |
| `__tests__/chart-pattern.parity.spec.ts` | 17 |
| `__tests__/candle-pattern.parity.spec.ts` | 17 |
| `__tests__/liquidity-sweep.parity.spec.ts` | 16 |
| `__tests__/external-signal.parity.spec.ts` | 25 |
| `__tests__/position-has-no.parity.spec.ts` | 14 |
| `__tests__/reverse-position.parity.spec.ts` | 2 |
| `__tests__/add-position.parity.spec.ts` | 2 |
| `__tests__/atomic-contract-position-lifecycle-parity.spec.ts` | 2 |

**策略**：这一桶是「同一 atom 的 legacy vs 期望输出」对照表，dispatcher 已能输出同形态 patch。批量替换 `new SemanticSeedExtractorService()` → `new GenericSeedDispatcher(ATOM_CONTRACT_REGISTRY)`，遇到 dispatcher 缺失 atom 路径时回填 dispatcher（这就是必须放开 dispatcher 红线的部分，见 §5）。

#### Bucket S4 — invariant / fallback / projection（合约不变量，可类比迁移）

| 文件 | 命中数 |
| --- | --- |
| `__tests__/seed-extractor-evidence-invariant.spec.ts` | 2 |
| `__tests__/semantic-seed-extractor.fallback-isolation.spec.ts` | 4 |
| `__tests__/semantic-seed-extractor.service.spec.ts` | 3 |
| `__tests__/semantic-event-frame-parser.service.spec.ts` | 3 |
| `__tests__/semantic-event-frame-projector.service.spec.ts` | 2 |
| `__tests__/semantic-projection-group-folding.spec.ts` | 4 |
| `__tests__/semantic-state-projection.service.spec.ts` | 2 |
| `__tests__/semantic-state-projection.service.dca-constraint-only.spec.ts` | 2 |
| `__tests__/semantic-state-projection.clarification-view.spec.ts` | 2 |
| `__tests__/semantic-state-merge.position-constraints.spec.ts` | 3 |
| `__tests__/push-helper-multi-match-invariant.spec.ts` | 3 |
| `__tests__/oscillator-phase-by-verb.spec.ts` | 5 |
| `__tests__/multi-entry-trigger-and-combination.spec.ts` | 3 |
| `__tests__/display-multi-ema-stack-regression.spec.ts` | 3 |
| `__tests__/display-hetero-and-combination.spec.ts` | 3 |
| `__tests__/atomic-contract-combination-semantics.spec.ts` | 2 |
| `__tests__/atomic-contract-position-lifecycle-semantics.spec.ts` | 2 |
| `__tests__/atomic-contract-position-lifecycle-canonical-ir.spec.ts` | 2 |
| `__tests__/canonical-spec-builder.service.spec.ts` | 2 |
| `__tests__/conversation-summary-user-prompt.spec.ts` | 2 |

**策略**：
- `semantic-seed-extractor.service.spec.ts` / `semantic-seed-extractor.fallback-isolation.spec.ts` / `semantic-event-frame-parser.service.spec.ts` / `semantic-event-frame-projector.service.spec.ts` → **删除**（legacy 实体不存在后契约消失，已被 dispatcher-self-baseline + dispatcher-semantic-equivalence 覆盖）。
- `seed-extractor-evidence-invariant.spec.ts` → **重写**为 dispatcher + state builder 链路的 invariant（evidence.text 子串规则不变，喂入源换成 dispatcher 输出）。
- 其余 projection / merge / canonical-spec-builder spec → 改 fixture 入口，把"先调 extractor 再断言 projection"改成"直接构造 `CodegenSemanticPatch` 或 `SemanticState` fixture"，绕开 extractor 中介；这一类不依赖 extractor 实现，只是借它造数据。

#### Bucket S5 — caller 集成 spec

| 文件 | 命中数 |
| --- | --- |
| `__tests__/codegen-conversation.service.spec.ts` | 3 |
| `__tests__/semantic-open-slot-answer-resolver.service.spec.ts` | 9 |

**策略**：跟随对应 production caller 切换；ctor 注入点从 `SemanticSeedExtractorService` 换成 `GenericSeedDispatcher`，重新 record 期望。

### 1.6 文档

| 文件 | 处理 |
| --- | --- |
| `apps/quantify/docs/phase3-coverage-report.md` | c-final 一次性更新引用名 |

---

## 2. dispatcher gap 矩阵

### 2.1 legacy `SemanticSeedExtractorService.extract()` 真实形态

```ts
extract(message?: string): CodegenSemanticPatch
```

- **输入**：单参 `message: string`（可选）。**没有额外 ctx**——这是关键发现，意味着 dispatcher 的 `dispatch(utterance)` 单参签名已经形态等价。
- **输出**：`CodegenSemanticPatch`（与 dispatcher 输出**同类型**）。
- **内部依赖**（6 个 ctor 注入，全部 default-new）：PositionSizingContractService / SemanticEventFrameParserService / SemanticEventFrameProjectorService / MarketInstrumentSymbolResolverService / NaturalLanguageGatewayService / SemanticFrameNormalizerService。
- **行为复杂度**：6611 行编码了大量 cross-atom 协调（dedup / anchor / skip / evidence formatting / lifecycle inheritance / trigger atomization / risk merging / position constraint extraction）；这就是 PR2 turn 3 "byte-equal vs legacy" 路线被证伪的根因。

### 2.2 codegen-conversation.service.ts 调用点 gap

| 维度 | legacy | dispatcher | gap |
| --- | --- | --- | --- |
| 调用点 | 私有方法 `extractSemanticPatchFromMessage`（L9121-L9126，内部 L9122 `this.semanticSeedExtractor.extract(message)`），被 **7 个上游调用站**共用：L267 / L1513 / L7409 / L9041 / L9075 / L9092 / L9107 | `dispatcher.dispatch(message)` | **签名等价**（均为单参 `message → CodegenSemanticPatch`） |
| 显式消费字段 | 私有方法返回口 L9123 `patch.contextSlots \|\| patch.triggers \|\| patch.actions \|\| patch.risk \|\| patch.position`（5 顶层 truthy 检查） | dispatcher 已能输出同 5 个顶层字段（PR2a/2b registry-driven） | 必须验证：7 caller 场景下 dispatcher 对随机用户散文 / 短句 / normalized 文本是否仍能产出非空 patch；若 dispatcher 路径稀疏导致退化，需在 PR2c4 补 atom 覆盖率 |
| **隐式消费字段** | `mergePlannerSemanticPatch` / `detectPatchConflicts` L9403-L9413 进一步读取 `patch.symbols[0]`（L9403）、`patch.timeframes[0]`（L9404）、`patch.riskRules.exchange / marketType`（L9408 / L9413） | dispatcher 输出包含同名字段（PR2b registry surface 已补齐 marketType / exchange） | **c4 acceptance 必须包含 4 字段契约 spec**：`patch.symbols`、`patch.timeframes`、`patch.riskRules.exchange`、`patch.riskRules.marketType` 在 dispatcher 输出形态与 legacy 等价（用 baseline 重录 + caller 集成 spec 双重锁） |
| 上下文 | `this` 持有 8000+ 行 service state，但本调用未消费 | 同 | 无 gap |
| 风险 | 7 caller path 各异：L267 是 initial message、L1513 是普通会话、L7409 是 normalized 路径、L9041/9075/9092/9107 是不同 fallback 分支；不是「LLM 请求失败的最后兜底」单一场景 | — | **必须加 caller 集成 spec**：7 caller path 同时受影响，需各自录最小 fixture 锁 contextSlots / 4 隐式字段不退化（用 ac-prompts fixture 度量） |

### 2.3 semantic-open-slot-answer-resolver.service.ts 调用点 gap

| 维度 | legacy | dispatcher | gap |
| --- | --- | --- | --- |
| 调用点 | L112 `this.seedExtractor.extract(input.message)` 直接喂给 `fulfillSemanticFragment` | `dispatcher.dispatch(input.message)` | **签名等价**；`fulfillSemanticFragment` 已是 patch-shape consumer |
| 上下文 | `input.currentState`（SemanticState）、`input.clarificationState` | 同 | dispatcher 不需要这些 ctx，extractor 也不需要——仅 `fulfillSemanticFragment` 用，无 gap |
| 关键路径 | open slot answer fulfillment（澄清回合用户回答 → patch → 状态合并） | — | 必须验证：用户回答短句（如 "btcusdt"、"5%"、"ema20"）下 dispatcher 对**碎片化输入**的鲁棒性——legacy 6611 行包含大量短句兜底，dispatcher 当前 atom 路由可能对短句返回空 patch |
| 风险 | 用户澄清回合断流（短句返回空 patch → 永远 open） | — | **PR2c3 必须放开 dispatcher 红线**，回填短句 atom 路径或显式 fallback；并加 spec 度量短句覆盖率 |

### 2.4 共性 gap 总结

1. **接口签名 100% 兼容**：legacy 与 dispatcher 都是 `(message: string) → CodegenSemanticPatch`，迁移机械成本低。
2. **行为差距集中在 atom 覆盖广度**：legacy 6611 行包含手写的散句兜底 / cross-atom dedup / lifecycle inheritance；dispatcher 当前依赖 registry-driven 路由，对 registry 未声明的 utterance 形态可能输出空 patch。
3. **没有"额外参数"差异**：本次摸底澄清了前轮"legacy 是否传额外 ctx"的疑虑——**没有**。
4. **真正的硬骨头是 spec 重写量**，不是 caller 切换。

---

## 3. spec 重写策略汇总

| 桶 | 文件数 | 策略 | 工作量 |
| --- | --- | --- | --- |
| S1 dispatcher-aligned | 2 | 不动；c-final 删 docstring | XS |
| S2 golden-corpus | 6 | 重写为 dispatcher 契约（`semantic-gateway-golden-corpus.spec.ts` 855 行单独拆） | L |
| S3 parity spec | 14 | 批量替换 `new SemanticSeedExtractorService()` → `new GenericSeedDispatcher(REGISTRY)`，遇 atom 缺失回填 dispatcher | M |
| S4 invariant / fallback / projection | 20 | 4 个 extractor/parser/projector 自身 spec 删除；evidence-invariant 重写；其余改 fixture 入口绕开 extractor | M |
| S5 caller 集成 | 2 | 随 production caller 切换 record 期望 | S |

---

## 4. PR2c 拆分提案

> 原则：每段 PR 单一 caller 域 + 锁住绿，dispatcher 红线只在必要段显式放开。

| PR | 范围 | dispatcher 改动 | spec 重写量 | 风险 | 依赖 |
| --- | --- | --- | --- | --- | --- |
| **c2** | atom-coverage / phase3 / golden-corpus 域（不含 855 行的 semantic-gateway-golden-corpus.spec）：S2 中 5 个 spec + S3 中无依赖 atom 的 6 个 parity spec（time-window / volume / volatility / divergence / add-position / reverse-position） | **否** | 11 spec | 低 — registry 已覆盖 | — |
| **c3** | open-slot resolver 域：production caller `semantic-open-slot-answer-resolver.service.ts` 切换 + 其 spec + 短句鲁棒性 atom 回填 | **是**（短句 atom 路径） | 1 production + 1 spec + dispatcher 增量 | 中 — 用户澄清断流 | c2 |
| **c4** | codegen-conversation 域：production caller `codegen-conversation.service.ts` 私有方法 `extractSemanticPatchFromMessage`（L9121-L9126）切换；7 caller path（L267 / L1513 / L7409 / L9041 / L9075 / L9092 / L9107）同时受影响，需各自录 caller 集成 spec；4 隐式字段（`symbols / timeframes / riskRules.exchange / riskRules.marketType`，由 `mergePlannerSemanticPatch / detectPatchConflicts` L9403-L9413 消费）必须有契约 spec | **可能**（若 7 caller 任一退化需补 atom） | 1 production + 7 caller path 集成 spec + 4 隐式字段契约 spec | 中 — 7 caller 同时受影响 | c2 |
| **c5** | parity spec 收尾：S3 剩余 8 个 atom-heavy parity spec（chart/candle/liquidity-sweep/external-signal/partial-take-profit/dca/position-has-no/atomic-contract-position-lifecycle-parity）+ S4 中 16 个 projection / merge / canonical / lifecycle / display / oscillator / push-helper / conversation-summary spec。**拆分门槛：dispatcher 净增 LoC > 800 或新增 atom 路径 > 5 时必须拆 c5a (chart/candle/liquidity-sweep/external-signal) + c5b (其余)；执行时若 dispatcher diff 超 800 行，本 PR 自动转为 c5a。** | **是**（chart-pattern / candle-pattern / liquidity-sweep / external-signal / dca 这些重 atom 槽，dispatcher 大概率有缺口） | 24 spec + dispatcher 增量 | 高 — atom 面最大 | c3、c4；**c5 必须 rebase 在 c3 之后（atom-contract registry 共享，c3 的 atom 增量先入 main 才能避免 c5 重复增删）**；c5 PR body 强制列对 c3 路径回归测试结果 |
| **c6** | semantic-gateway-golden-corpus.spec.ts（855 行） + S4 中 4 个 extractor/parser/projector 自身 spec 删除 + evidence-invariant 重写 | **是**（依 c5 落地的 atom 增量） | 6 spec（4 删 1 重写 1 重建） | 高 — golden corpus 是平台 P0 校验 | c5 |
| **c-final** | 物理删 `semantic-seed-extractor.service.ts` + `semantic-event-frame-parser.service.ts`；删 module providers L79/L81 + module spec 同步；删 eslint allowlist L215；改 atom-contract types `atom-contract-surface.types.ts` + `atom-contract-types.ts` + `phase3-coverage-report.md` 引用；删 dispatcher-self-baseline / dispatcher-semantic-equivalence docstring 中 legacy 引用 | **否** | 0 重写（仅清扫） | 低 — 纯清扫 | c2..c6 |

> 估算总体：6 段 PR + 1 终结清扫；c5 是最大单段（24 spec + atom 增量）；c5 拆分门槛见上。
> **拓扑约束**：c2 → (c3 ∥ c4) → c5（rebase on c3，registry 共享）→ c6 → c-final。

---

## 5. 红线放开 / 收紧建议

### 必须放开 dispatcher 红线的段

| 段 | 原因 | 收紧机制 |
| --- | --- | --- |
| **c3** | open-slot resolver 调用点对短句鲁棒性要求高，dispatcher 当前 registry-driven 路径对碎片化输入可能空 patch；不放开就堵 caller 切换 | (a) 新增 `dispatcher-fragment-utterance-coverage.spec.ts`：用 open-slot 实测短句语料锁住覆盖率不退化；(b) dispatcher diff 必须重录 `dispatcher-self-baseline.json`；(c) dispatcher-semantic-equivalence 矩阵新增短句桶 |
| **c5** | 大量 parity spec（chart / candle / liquidity-sweep / external-signal / dca 等）依赖 legacy 在 6611 行内手写的 atom 槽细节；dispatcher registry 必有补齐 | (a) 每加一个 atom 路径同步加 atom_contract registry 项 + AC-13 ESLint 守门；(b) 每段必须 piggyback `dispatcher-self-baseline` 重录 + `dispatcher-semantic-equivalence` 增量断言；(c) PR body 必须列出新加 atom 路径清单及对应 spec |
| **c6** | `semantic-gateway-golden-corpus.spec.ts` 是 P0 平台 spec，其 P0 句子（`'15min k线 在价格都位于ema20 ema60 ema144 上方时候只开多 ...'`）已经是 dispatcher 必须支撑的最小契约；任何缺口必须回填 | (a) 仅允许 dispatcher 加 atom 路径，**不允许 dispatcher 改既有路径输出形态**；(b) 重写后的 spec 必须保留 P0 输入并在 PR body 引用 diff |

### 必须保持收紧的段

| 段 | 红线 |
| --- | --- |
| **c2** | 0 dispatcher 改动；纯 spec 重写 + fixture 适配，先把"明面上 dispatcher 已能覆盖"的部分锁死 |
| **c4** | dispatcher 仅允许补**transport_failure 兜底命中率**所需 atom；不允许借机改既有 atom 行为 |
| **c-final** | 0 dispatcher 改动；纯物理删 + 清扫；通过即可永久关闭 legacy 红线 |

### 通用收紧机制（贯穿 c2..c-final）

1. **dispatcher-self-baseline.spec.ts** 是不可绕过的回归门——每个允许 dispatcher 改动的 PR 必须显式重录 baseline 并在 PR body 注明 diff 原因。
2. **AC-13 ESLint enforce**（PR2a 已落地）继续守门：业务代码禁 import legacy；c-final 前所有新增 dispatcher 路径必须经 registry。
3. **每段 PR body 必须列出**：`dispatcher 净增 atom 路径清单`、`spec 重录 baseline 行数`、`是否触发 dispatcher-semantic-equivalence 矩阵更新`。
4. **caller 切换段（c3/c4）必须有 e2e 兜底**：`dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen` 全绿才能合。

---

## 6. 风险预案

### 6.1 dispatcher gap 反向证据（baseline 已覆盖 5 顶层字段）

实测 `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/__snapshots__/dispatcher-self-baseline.json`（1.3MB / 43118 行）：

- 5 顶层字段（`contextSlots / triggers / actions / risk / position`）出现匹配 **1105 行**，覆盖密度足够；snapshot 已锁住 dispatcher 当前对 5 字段的输出形态
- 这是 c4 切换的反向证据：dispatcher 输出 5 顶层字段不是空想，已被 baseline 锁住
- **风险**：baseline 仅锁 P0 句子集（通过 dispatcher-self-baseline 录制），对 7 caller 的散文 / 短句 / normalized 文本未必覆盖；c4 必须新增 caller-aware fixture spec 而非依赖 baseline 单点

### 6.2 atom registry 当前覆盖 vs legacy 6611 行 atom kinds 对比

- 当前 registry：`apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts` 通过 `completePr1bRegistry({...})` 暴露 `ATOM_CONTRACT_REGISTRY`；类型守卫 `_ExhaustiveCheck`（L1206）强制 `SupportedExecutableUtteranceAtom` 全覆盖（即 dispatcher 的 atom 集合 = `SupportedExecutableUtteranceAtom`）
- legacy `semantic-seed-extractor.service.ts` 6611 行内的 atom 字面量大量使用动态字符串拼装 + cross-atom 协调，**没有静态 `atomKey: 'xxx'` 字面量字段**（grep 命中为 0），无法用机械差集；意味着 legacy atom 表面边界只能通过运行时输出 baseline 反推
- **预案**：c5/c6 必须 piggyback `dispatcher-self-baseline` + `dispatcher-semantic-equivalence` 的 diff 作为 legacy↔dispatcher atom 差集的**唯一**对照面；任何 spec 重写时 baseline 出现非预期 diff 必须在 PR body 解释

### 6.3 main 漂移风险：codegen-conversation.service.ts 持续被改的 rebase 策略

c2..c-final 周期内 `codegen-conversation.service.ts`（9496 行）极可能被其他 PR 改动（业务高频文件）。预案：

1. **每段 PR 开头先 rebase**：`git fetch origin && git rebase origin/main`，再跑一次 `dx build quantify --dev` 锁基线
2. **c4 强制 rebase 后重抓 7 caller 行号**：用 `grep -n extractSemanticPatchFromMessage apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts` 重新校准 7 caller 行号（本报告 L267 / L1513 / L7409 / L9041 / L9075 / L9092 / L9107 数据基线为 origin/main `50101a138`，rebase 后必变）
3. **冲突 SOP**：`extractSemanticPatchFromMessage` 私有方法本体冲突 → 优先保留 c4 切换版本（dispatcher 调用）；调用站冲突 → 接受 main 改动后逐站重新接入 dispatcher
4. **c-final 前最后一次 rebase 必须重跑 §0 数字摸底**：caller 文件总数 / spec 桶分布若变动 > 10%，需在 c-final PR body 显式说明

### 6.4 e2e quantify 用例清单（caller 切换硬门槛）

`apps/quantify/e2e/llm-strategy-codegen/`：

- `llm-strategy-codegen.e2e-spec.ts`（13.8K）
- `multi-leg-dispatch.e2e-spec.ts`（17.7K）
- `original-strategy-flow.e2e-spec.ts`（15.5K）

共 **3 个 e2e case**。c3 / c4 / c5 / c6 合并前必须全绿：`dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen` exit 0；c-final 必须额外跑一次确保物理删后 e2e 仍绿。

---

## 7. 一句话提交建议

PR2c1 后建议立刻开 c2（最低风险、最大 spec 净化、为 c3/c4/c5 解锁 dispatcher 增量铺路），c2 ship 后再让 c3 / c4 并行（caller 互不依赖），c5 rebase 在 c3 之后（registry 共享）、c6 串行收尾，c-final 一键清扫。
