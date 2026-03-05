# 实施计划：巨鲸监控本地降级（后端无路由）

## 目标
修复地址“一键监控”在后端缺少 `whale-notification` 路由时创建失败的问题，保证前端可降级到本地存储。

## 任务拆分

### Task 1: 调整请求降级判定
文件：
- `apps/front/src/features/whale-notification/api/whale-notification-api.ts`

变更：
- `requestWithFallback` 中将 `404/405` 归类为 fallback 候选失败（不抛错）。
- 保持 `401/403` 抛错。
- 保持 `5xx/网络异常` fallback。
- 其余 `4xx` 继续抛错。

### Task 2: 验证创建/列表链路
场景：
- backend 无 `/api/v1/whale-notification/*`。

检查：
- 地址页“一键监控”提交成功。
- 监控页列表显示新建规则。
- 刷新后规则仍存在（localStorage）。

### Task 3: 回归安全边界
检查：
- `401/403` 不出现伪成功。
- 现有用户隔离 key（scopedStorageKey）仍生效。

## 验证命令（建议）
- `pnpm -C apps/front exec eslint src/features/whale-notification/api/whale-notification-api.ts --config ../../eslint.config.js`
- 手工验证：
  - `http://localhost:3011/zh/whale-tracking/profile/...`（地址一键监控）
  - `http://localhost:3011/zh/whale-tracking/notifications`

## 交付结果
- 一键监控在本地 backend 未实现通知路由时不再报 `Cannot POST .../rules`。
- 行为与既有 local fallback 策略一致。
