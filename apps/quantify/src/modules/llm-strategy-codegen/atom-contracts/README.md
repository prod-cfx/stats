# atom-contracts — Atom 元数据唯一真相源

## 概述

本目录是 `llm-strategy-codegen` 模块中所有 **atom 元数据**的唯一真相源（Single Source of Truth）。

任何 atom 的分类、意图、参数、展示信息、IR emit 形态，均以 `ATOM_CONTRACT_REGISTRY` 为准。
禁止在其他文件新建第二个 atom 数组、map 或注册表。

---

## 目录结构

```
atom-contracts/
├── atom-contract-registry.ts       # ATOM_CONTRACT_REGISTRY — 唯一 atom 元数据注册表
├── atom-contract-types.ts          # 类型定义（AtomContract、AtomClassifier 等）
├── atom-public-names.ts            # 各语言 publicName（zh/en）
├── utterance-corpus/               # NL 语料 fixture（dispatcher 训练/测试用）
└── __tests__/                      # 注册表不变量 spec
```

---

## ATOM_CONTRACT_REGISTRY

文件：`atom-contract-registry.ts`

每个 atom 条目包含：

| 字段 | 说明 |
|------|------|
| `key` | atom 全局唯一标识，格式 `<namespace>.<name>`（如 `rsi.oversold`） |
| `bucket` | 所属桶：`trigger / action / risk / positionConstraint / orchestration` |
| `classifier` | 支持状态（`supported_executable` / `unsupported_*`）、版本门控 |
| `surface` | NL 意图关键词、动词同义词、参数槽定义、阶段/方向解析器 |
| `display` | 多语言公开名称、摘要模板（`zh/en publicName`、`summaryTemplate`） |
| `emit` | IR emit 能力描述（`capability`、`capabilityStatus`、`irShape`） |
| `mutex` | 互斥 atom 列表 |
| `isActionable` | 是否可直接产生交易动作 |

### 添加新 atom 步骤

1. 在 `atom-contract-registry.ts` 中添加条目（含完整 classifier / surface / display / emit）
2. 在 `atom-public-names.ts` 中补充 `zh/en publicName`
3. 若需 NL 展示，在 `display-registry`（`nl-gateway/display-registry/`）中注册 display token
4. 运行 `dx test unit quantify` 确认不变量 spec 全绿

### 不变量

`__tests__/atom-contract-registry-classifier-coverage.invariant.spec.ts` 守门：
- 每个条目必须有 `classifier.supportStatus`（合法值）
- `unsupported_*` 状态必须携带 `unsupportedMeta.reasonCode`
- `supported_executable` 不得携带 `unsupportedMeta`

---

## ATOM_BUCKETS

`ATOM_BUCKETS` 是从 `ATOM_CONTRACT_REGISTRY` 派生的 `key → bucket` 快查 map，由构建脚本/工具层消费。
不要手动维护——所有 bucket 信息以 `ATOM_CONTRACT_REGISTRY[key].bucket` 为准。

---

## SemanticAtomRegistryService 与本目录的关系

`SemanticAtomRegistryService`（`services/semantic-atom-registry.service.ts`）是消费侧适配层：

- **优先级**：`STANDALONE_ATOM_MAP`（遗留精确参数覆盖）> `ATOM_CONTRACT_REGISTRY`（通用派生）
- **REGISTRY_ONLY_KEYS**：orchestration/scope 类别以及 `action.open_long` 等 dotted action 键
  由其他服务单独消费，不暴露给 `list()/get()/resolve()` 的调用方。
- **bare-key 动作标签**（`open_long`、`close_long` 等）存入 `STANDALONE_ATOM_MAP`，
  因为 `SemanticState.actions[].key` 历史上存储的是这些裸标签而非 dotted 键。

### 禁止事项

- 在 `SemanticAtomRegistryService` 以外新建 atom 数组或 map
- 绕过 `SemanticAtomRegistryService` 直接枚举 `ATOM_CONTRACT_REGISTRY` 做运行时分流
- 在 `ATOM_CONTRACT_REGISTRY` 之外维护 atom 分类信息

ESLint 守门规则 `no-second-atom-registry`（`eslint-rules/no-second-atom-registry.js`）
采用 **structural 检测**（选项 A）：扫描 ArrayExpression / new Map 中同时含 `key` + `supportStatus`
字符串 property 的对象元素，不依赖变量命名。豁免文件通过 `eslint.config.js` ignores 配置。

> **best-effort 说明**：规则检测模块级变量声明；局部变量、动态拼接等场景仍需 code review 兜底。
> 已知绕过方式：将数组包裹在函数返回值中（函数内变量被豁免，符合预期——函数级局部数据不构成持久化第二数据源）。

**重要约束：**
- 新 atom 只加 `ATOM_CONTRACT_REGISTRY`，**不要向 `STANDALONE_ATOM_MAP` 添加新条目**
- `STANDALONE_ATOM_MAP` 仅用于已有条目的精确 `requiredParams/substrate` 覆盖，不接受新 atom

---

## PR 演进历史（Issue #1334）

| PR | 内容 |
|----|------|
| PR1 (#1336) | 引入 `ATOM_CONTRACT_REGISTRY` + classifier 类型系统 |
| PR2 (#1337) | 将 atom 数据迁入 REGISTRY（classifier 数据迁移） |
| PR3 (#1340) | `SemanticAtomRegistryService.resolve` 切换读 REGISTRY |
| PR4（本次）| 物理删除 `ATOMS` 数组 + `_LEGACY_ATOMS_MAP_PR4` + 工厂函数；添加守门规则 |
