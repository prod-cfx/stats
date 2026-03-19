# AI 量化前端双实例信号联调设计（只改 AI 量化模块）

## 1. 背景与目标

本次联调仅针对前端 AI 量化模块，目标是让前端可同时验证：

1. Quantify 市场数据（`/api/v1/market/*`）能获取并可用于 AI 量化页面。
2. 经典策略实例与 LLM 策略实例都能获取到真实 signals。
3. 前端将两路 signals 合并成一条时间线，并带来源标签（classic/llm）。

明确边界：

- 只改以下目录（及其直接依赖的新建 AI 量化数据层文件）：
  - `apps/front/src/components/account`
  - `apps/front/src/components/ai-quant`
- 其他已在生产稳定运行的数据模块不修改。
- 非本次真实联调链路（例如部分回测/部署相关能力）保持 mock，但必须显式标注 mock 状态。

## 2. 范围

### 2.1 In Scope

1. 对接真实接口：
   - `GET /api/v1/market/*`（本次 AI 量化所需的市场快照/行情读取）
   - `GET /api/v1/strategy-instances`
   - `GET /api/v1/strategy-instances/:id/signals`
   - `GET /api/v1/llm-strategy-instances`
   - `GET /api/v1/llm-strategy-instances/:id/signals`
2. 前端合并时间线：按时间倒序合并 classic + llm signals，并带来源标签。
3. 局部降级与 mock：单路失败不阻断双路联调，双路都失败才整体降级 mock。

### 2.2 Out of Scope

1. 非 AI 量化模块页面重构。
2. 后端接口语义改造。
3. 交易执行链路深改（下单、仓位、账户管理后端逻辑）。

## 3. 设计方案（推荐：AI 量化专用聚合层）

### 3.1 分层

新增 AI 量化数据聚合层（建议目录：`apps/front/src/features/ai-quant-data/`）：

1. `clients`：封装对 Quantify 实际接口调用。
2. `adapters`：把 classic/llm 两种 signals 统一映射为前端统一模型。
3. `timeline`：完成双路合并、排序、去重（必要时）与来源标记。
4. `fallback`：对失败场景进行局部 mock 降级。

组件层（`components/account`、`components/ai-quant`）只消费统一 ViewModel，不直接拼接接口。

### 3.2 统一信号模型

```ts
interface UnifiedSignalItem {
  source: 'classic' | 'llm'
  strategyInstanceId: string
  symbol: string
  action: string
  timestamp: string
  confidence?: number | null
  isMock: boolean
  raw?: unknown
}
```

说明：`raw` 仅用于调试和兼容后续字段扩展，不用于展示逻辑判断。

### 3.3 页面行为

1. 页面初始：并行拉取 classic/llm 运行实例列表与市场快照。
2. 选中实例后：并行拉 signals；合并为一条时间线。
3. UI 展示：时间线每条信号显示来源标签（Classic / LLM）。
4. 筛选能力：`all | classic | llm`（默认 all）。

## 4. 错误处理

1. 单路失败：
   - 页面展示另一条路真实数据。
   - 显示 warning（例如“LLM 信号暂不可用”）。
2. 双路失败：
   - 时间线降级到 mock。
   - 显示 error 提示“当前为模拟数据”。
3. 数据可信标记：
   - 每条信号都带 `isMock`。
   - 页面可见“real/mock 数量”。

## 5. 联调验收标准（DoD）

1. AI 量化页可同时看到 classic + llm 两路实例。
2. 合并时间线可展示真实 signals，且每条有来源标签。
3. 至少可确认一条真实信号（`isMock=false`）进入时间线。
4. 模拟单路故障时，页面局部降级但不白屏。
5. 只影响 AI 量化相关目录与新增聚合层文件；其他稳定模块零修改。

## 6. 风险与控制

1. 风险：两路 signals 字段不完全一致。
   - 控制：统一模型 + adapter 层，UI 永远读统一字段。
2. 风险：生产环境 llm signals 可能有订阅访问限制。
   - 控制：前端展示鉴权/订阅提示，不把 403 误判为系统故障。
3. 风险：前端误把 mock 当真实。
   - 控制：强制 `isMock` 字段透传并可视化。

## 7. 实施顺序（仅设计，不含具体代码）

1. 落地 AI 量化聚合层骨架与统一模型。
2. 接入 classic/llm 实例与 signals 客户端。
3. 完成合并时间线与来源标签。
4. 接入错误分级与 mock 降级。
5. 在 AI 量化页面完成验证入口与调试信息展示。

## 8. 非功能约束

1. 保持现有用户路径不破坏（Never break userspace）。
2. 未联调成功前，不改动稳定生产模块。
3. 新逻辑默认仅在 AI 量化模块生效。
