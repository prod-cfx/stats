# 巨鲸监控本地降级设计（后端无路由时可创建）

## 背景
在地址页点击“一键监控”时，前端请求：
- `POST /api/v1/whale-notification/rules`

当前本地 backend 未提供 `whale-notification` 路由，返回：
- `Cannot POST /api/v1/whale-notification/rules`（404）

现状前端逻辑对 `404` 直接抛错，导致弹窗创建失败。

## 目标
- 后端未提供 `whale-notification` 路由时，前端继续支持本地创建规则（localStorage）。
- 保持已实现的鉴权边界：`401/403` 不降级。
- 不改后端，仅前端容错策略调整。

## 方案对比
### 方案 A（采用）
将 `404/405` 视为“接口不存在”，进入 fallback 本地模式。

优点：
- 与用户期望一致：一键监控可用。
- 对现有接口上线后无侵入：服务端恢复时自动走远端。

风险：
- 用户可能误判为已写入服务端。

缓解：
- 可选增加轻提示“本地模式”。

### 方案 B
仅创建动作 fallback，列表/更新/删除不 fallback。

缺点：
- 体验割裂，不采用。

### 方案 C
完全严格失败。

缺点：
- 与产品诉求冲突，不采用。

## 详细设计
### 1) requestWithFallback 状态机调整
文件：
- `apps/front/src/features/whale-notification/api/whale-notification-api.ts`

规则：
- `401/403`：继续抛错（不降级）。
- `404/405`：标记为 fallback 候选失败，不抛错，继续尝试其他 endpoint candidate；候选都不可用则返回 `{ kind: 'fallback' }`。
- `5xx`/网络异常：保持现有 fallback 行为。
- 其余 `4xx`（如 400/422）：继续抛错（参数问题应显式暴露）。

### 2) 调用层行为
- `create/list/update/delete` 在 `outcome.kind === 'fallback'` 时全部走 localStorage 逻辑。
- 保持本地数据按用户 scope 隔离（现有 `scopedStorageKey` 机制不变）。

### 3) UX 提示（可选）
- 在本地 fallback 成功创建后可加轻提示：`已在本地模式创建`。
- 本次实现可先不加，避免引入 i18n 文案改动。

## 验收标准
1. 当前 backend 无 `whale-notification` 路由时：
- 地址“一键监控”创建成功。
- 规则可在“监控地址”列表显示，刷新后仍在。

2. 后端有路由时：
- 优先远端成功，不影响现有逻辑。

3. 安全边界：
- `401/403` 仍报错，不伪成功。

## 非目标
- 不实现后端 `whale-notification` 模块。
- 不改登录系统流程。
- 不做跨端同步策略扩展。
