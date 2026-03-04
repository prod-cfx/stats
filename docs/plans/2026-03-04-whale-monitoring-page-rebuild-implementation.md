# 实施计划：巨鲸监控页重构（监控地址 + 实时巨鲸）

## 目标
将监控页改造为两个高保真区块：
- 监控地址（指标 + 操作）
- 实时巨鲸（同实时巨鲸页表体 + 币种阈值规则）

## 任务拆分

### Task 1: 组件拆分与页面编排
文件：
- 修改：`apps/front/src/components/whale-tracking/notifications/NotificationsClient.tsx`
- 新增：`apps/front/src/components/whale-tracking/notifications/AddressMonitorSection.tsx`
- 新增：`apps/front/src/components/whale-tracking/notifications/RealtimeWhaleMonitorSection.tsx`

目标：
- `NotificationsClient` 只做状态编排。
- 用两块专用 section 替代当前通用 `MonitorSection` 展示。

### Task 2: 监控地址区实现
目标：
- 渲染地址 + 指标列：
  - 永续合约总价值
  - 未实现盈亏
  - 可用保证金
  - 保证金使用率
  - 持仓
- 操作按钮：
  - 交易统计（页内弹窗）
  - 关闭 Telegram
  - 编辑
  - 删除

数据：
- `ADDRESS` 规则 + 持仓页现有接口按地址查询指标。

### Task 3: 实时巨鲸区实现
目标：
- 表体样式/列结构与实时巨鲸页保持一致。
- 顶部提供币种 + 阈值金额输入，创建 `SYMBOL` 规则。

数据：
- 复用实时巨鲸现有数据流。
- 规则写入走 `createWhaleNotificationRule`。

### Task 4: 复用交易统计弹窗
目标：
- 在监控地址区点击“交易统计”直接打开现有 `WhaleTradingStatsModal`。
- 不跳转页面。

### Task 5: 回归与降级验证
检查：
- 规则接口 404/405 时可 fallback 本地创建。
- 401/403 无伪成功。
- 单地址指标失败不影响全表。
- 浅色/深色视觉保持一致。

## 验证命令
- `pnpm -C apps/front exec eslint src/components/whale-tracking/notifications src/components/whale-tracking/realtime/RealtimeWhalesTable.tsx --config ../../eslint.config.js`

## 手工验收路径
1. 地址详情页 -> 一键监控 -> 监控地址区显示新地址及指标。
2. 点击“交易统计” -> 页内弹出现有统计弹窗。
3. 点击“关闭 Telegram/编辑/删除” -> 行状态同步更新。
4. 实时巨鲸区 -> 选择币种+阈值创建规则成功。
