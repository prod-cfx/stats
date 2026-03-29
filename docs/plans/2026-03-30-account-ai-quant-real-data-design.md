# /account?tab=ai-quant 我的策略真实数据接入设计

## 背景
当前账户页 AI 量化“我的策略”虽然调用了后端接口，但前端仍存在 mock 合并/兜底逻辑，导致页面可能混入本地假数据。业务目标是只展示“已部署/已订阅”的 LLM 对话生成策略，并确保列表与详情口径一致。

## 需求确认
- 环境策略：生产禁用 mock；开发环境允许通过开关启用 fallback。
- 展示范围：仅“已部署/已订阅”策略。
- 过滤口径：`isSubscribed === true && status !== 'draft'`。
- 过滤位置：优先后端筛选，前端做兜底。
- 详情约束：与列表一致，未订阅或 draft 详情不可访问。

## 核心判断
值得做。当前问题是“数据来源不纯 + 展示口径不统一”，会直接误导用户。最小正确方案是把口径下沉到后端查询层，前端仅兜底，避免 userspace 被 mock 污染。

## 方案对比
### 方案 A：前端硬过滤
- 仅在前端过滤 `isSubscribed && !draft`。
- 优点：改动快。
- 缺点：后端仍返回非目标数据；分页不准；详情需要额外拦截且易漂移。

### 方案 B：后端扩展查询语义（推荐）
- `quantify` 与 `backend proxy` 新增筛选参数，前端按参数请求。
- 前端保留兜底过滤。
- 详情接口新增同口径访问门禁。
- 优点：语义一致、分页准确、列表详情闭环。

### 方案 C：新增独立 endpoint
- 新建 `/deployed-strategies`。
- 缺点：API 膨胀，YAGNI。

## 选型
采用方案 B。

## 详细设计
### 1) 列表筛选下沉到后端
- `quantify` 列表 query DTO 增加：
  - `subscribedOnly?: boolean`
  - `excludeDraft?: boolean`
- repository 查询语义：
  - `subscribedOnly=true` -> 仅 `subscriptions.some(userId, status=active)`
  - `excludeDraft=true` -> 叠加 `status != draft`
- `backend ai-quant-proxy` 列表 DTO 与 service 透传上述字段。
- `front` 调用列表接口时固定携带：
  - `subscribedOnly=true`
  - `excludeDraft=true`
- `front` 对返回结果做最后兜底过滤：
  - `item.isSubscribed === true && item.status !== 'draft'`

### 2) 详情访问约束
- `quantify` 在 `getStrategyDetail` 判定：
  - 若 `!isSubscribed || status === 'draft'`，返回不可见（对外 404 语义，避免对象存在性泄漏）。
- `front` 详情页沿用失败兜底，但文案改为“策略不存在或不可访问”。

### 3) mock 策略
- `front` 保留 `NEXT_PUBLIC_ACCOUNT_AI_QUANT_MOCK_FALLBACK`，但规则收敛：
  - `production` 强制不使用 account-ai-quant mock fallback。
  - `non-production` 且开关为 `true`，仅在真实请求失败时整体 fallback。
- 移除“远端 + mock 合并”行为。
- mock 路径同样应用 `isSubscribed && !draft` 过滤，保证 dev 与 prod 口径一致。

## 兼容性与风险
- 向后兼容：新增查询参数均为可选，不传时维持旧行为，不破坏现有调用方。
- 风险点：
  - 查询逻辑变更可能影响分页 total。
  - 详情门禁可能使历史直链变为不可访问（符合新口径，需明确预期）。

## 验收标准
- `/account?tab=ai-quant` 不再混入 mock 数据。
- 页面只展示 `isSubscribed=true && status!=draft`。
- 未订阅或 draft 的详情链接不可访问。
- 生产环境 account-ai-quant 失败时不走 mock fallback。

## 测试场景（需求映射）
1. Happy path：返回混合数据时仅显示已订阅非 draft；详情访问合规策略成功。
2. Edge：全量 draft/未订阅时空态正确；分页边界正确。
3. Error：生产失败无 fallback；开发开关开启时 fallback 生效且仍过滤。
4. 状态迁移：draft->running 且订阅激活后出现；取消订阅后列表消失且详情不可访问。
