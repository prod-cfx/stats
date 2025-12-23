# Mock 数据替换为真实 API 调用 - 完成总结

## 已完成的工作

### 1. ✅ 在 `api.ts` 中添加策略相关 API 调用函数

**文件**: `apps/front/src/lib/api.ts`

新增以下 API 函数：

#### 策略实例相关
- `fetchStrategyInstances()` - 获取运行中的策略实例列表
- `fetchStrategyInstanceDetail(id)` - 获取策略实例详情

#### 用户订阅相关
- `createSubscription(payload)` - 订阅策略
- `fetchMySubscriptions(query)` - 获取我的订阅列表
- `fetchSubscriptionDetail(subscriptionId)` - 获取订阅详情
- `updateSubscription(subscriptionId, payload)` - 更新订阅状态
- `cancelSubscription(subscriptionId)` - 取消订阅

### 2. ✅ 创建数据映射函数

**文件**: `apps/front/src/lib/mappers.ts` (新建)

创建了以下映射函数，将后端 DTO 转换为前端展示类型：

- `mapStrategyInstanceToStrategy()` - 策略实例 → 策略卡片
- `mapStrategyInstanceToDetail()` - 策略实例 → 策略详情
- `mapSubscriptionToStrategyItem()` - 订阅记录 → "我的策略"表格项
- `getStrategyIcon()` - 根据策略名称选择图标
- `formatRelativeDate()` - 格式化相对时间

### 3. ✅ 更新 `strategies-service.ts`

**文件**: `apps/front/src/services/strategies-service.ts`

**改动**:
- ❌ 删除：所有 Mock 数据常量
- ✅ 新增：调用真实 API `fetchStrategyInstances()` 和 `fetchStrategyInstanceDetail()`
- ✅ 新增：错误处理，API 失败时返回空数据而不是崩溃
- ✅ 新增：使用 mapper 函数转换数据格式

**影响的页面**:
- `/strategies` - 策略列表页
- `/strategies/[id]` - 策略详情页

### 4. ✅ 更新 `my-strategies-service.ts`

**文件**: `apps/front/src/services/my-strategies-service.ts`

**改动**:
- ❌ 删除：所有 Mock 数据
- ✅ 新增：调用真实 API `fetchMySubscriptions()` 获取用户订阅列表
- ✅ 新增：使用 mapper 函数转换订阅数据为策略表格项
- ✅ 新增：动态计算统计数据（运行中/暂停策略数量）
- ⚠️ 待完善：持仓数据（`openPositions` 和 `positions`）目前返回空数组，需要后端提供持仓查询接口

**影响的页面**:
- `/my-strategies` - 我的策略页面

### 5. ✅ 实现 `UseStrategyModal` 真实订阅逻辑

**文件**: `apps/front/src/components/strategies/UseStrategyModal.tsx`

**改动**:
- ✅ 导入 `createSubscription` API 函数
- ✅ 在 `handleFinalConfirm()` 中调用真实的订阅 API
- ✅ 添加错误处理，订阅失败时显示错误信息
- ✅ 将用户输入的参数（金额、币种、自动平仓选项）传递给后端

### 6. ✅ 更新 `StrategiesTable` 组件

**文件**: `apps/front/src/components/my-strategies/StrategiesTable.tsx`

**改动**:
- ✅ 导入 `updateSubscription` 和 `cancelSubscription` API 函数
- ✅ `handleToggleStatus()` - 调用真实 API 更新订阅状态（暂停/恢复）
- ✅ `handleTerminate()` - 调用真实 API 取消订阅
- ✅ 添加错误处理，操作失败时显示错误提示
- ⚠️ `handleAddFunds()` 和 `handleReduceFunds()` 标记为 TODO，需要账户充值/提现接口

---

## 数据流对比

### 之前（Mock 数据）

```
前端页面 → Mock Service → 返回硬编码数据 → 展示
```

### 现在（真实 API）

```
策略列表流程:
前端 /strategies → fetchStrategyInstances() 
→ GET /api/v1/strategy-instances 
→ 后端返回实例列表 
→ mapper 转换格式 
→ 展示

订阅策略流程:
前端点击"使用策略" → UseStrategyModal 
→ createSubscription() 
→ POST /api/v1/user/strategy-subscriptions 
→ 创建订阅记录 
→ 显示成功

我的策略流程:
前端 /my-strategies → fetchMySubscriptions() 
→ GET /api/v1/user/strategy-subscriptions 
→ 后端返回订阅列表 
→ mapper 转换格式 
→ 展示策略表格

更新订阅状态:
前端操作 → updateSubscription(id, { status: 'paused' }) 
→ PATCH /api/v1/user/strategy-subscriptions/:id 
→ 更新成功 
→ 刷新本地状态
```

---

## 待完善的功能（需要后端新接口）

### 1. 持仓数据接口
**需求**: 获取用户在某个策略下的当前持仓和历史持仓
**建议接口**:
```
GET /api/v1/user/strategy-subscriptions/:subscriptionId/positions?status=open
GET /api/v1/user/strategy-subscriptions/:subscriptionId/positions?status=closed
```

### 2. 账户统计数据接口
**需求**: 获取用户的总资产、今日盈亏等统计信息
**建议接口**:
```
GET /api/v1/user/account/stats
```
返回:
```json
{
  "totalAssets": "12340.56",
  "totalPnl": "2018.90",
  "todayPnl": "126.40",
  "todayRealizedPnl": "86.20"
}
```

### 3. 策略性能指标接口
**需求**: 获取策略实例的历史表现数据（月收益率、最大回撤、年化收益等）
**建议接口**:
```
GET /api/v1/strategy-instances/:id/performance
```

### 4. 交易信号/历史动作接口
**需求**: 获取策略的最近交易动作记录
**建议接口**:
```
GET /api/v1/strategy-instances/:id/recent-signals?limit=10
```

### 5. 账户充值/提现接口
**需求**: 为策略追加或减少资金
**建议接口**:
```
POST /api/v1/user/strategy-subscriptions/:subscriptionId/deposit
POST /api/v1/user/strategy-subscriptions/:subscriptionId/withdraw
```

### 6. 交易所账户管理
**需求**: 用户需要先绑定交易所账户才能订阅策略
**建议流程**:
1. 用户在"账户管理"页面绑定交易所 API Key
2. 订阅策略时从已绑定的账户中选择
3. 当前 `UseStrategyModal` 中已预留 `exchangeAccountId` 字段，但尚未实现选择逻辑

---

## 测试检查清单

### 策略列表页 `/strategies`
- [ ] 页面加载时能否正常显示后端返回的策略列表？
- [ ] 如果后端没有策略，是否显示空状态而不是崩溃？
- [ ] 点击策略卡片能否正常跳转到详情页？

### 策略详情页 `/strategies/[id]`
- [ ] 能否根据 URL 中的 ID 加载对应的策略详情？
- [ ] 如果策略 ID 不存在，是否返回 404 页面？
- [ ] 点击"使用策略"按钮能否打开弹窗？

### 订阅策略流程
- [ ] 在弹窗中填写金额后点击"确认使用"，能否成功调用后端 API？
- [ ] 订阅成功后是否显示成功页面？
- [ ] 订阅失败是否显示错误提示？
- [ ] 如果用户未登录，是否正确跳转到登录页？

### 我的策略页 `/my-strategies`
- [ ] 登录后能否看到自己的订阅列表？
- [ ] 策略表格中的状态（运行中/暂停）是否正确显示？
- [ ] 点击"暂停策略"能否成功更新状态？
- [ ] 点击"恢复策略"能否成功更新状态？
- [ ] 点击"终止策略"能否成功取消订阅？
- [ ] 操作失败是否显示错误提示？

### 认证相关
- [ ] 未登录时访问 `/my-strategies` 是否重定向到登录页？
- [ ] Token 过期时是否正确处理并提示重新登录？

---

## 环境变量配置

确保 `.env` 文件中配置了正确的 API 地址：

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1
```

生产环境：
```env
NEXT_PUBLIC_API_BASE_URL=https://your-production-domain.com/api/v1
```

---

## 注意事项

1. **认证 Token**: 所有用户相关的 API（订阅、我的策略等）都需要在请求头中携带 `Authorization: Bearer <token>`，已在 `api.ts` 中通过 `requireAuthHeaders()` 函数自动处理

2. **错误处理**: 所有 Service 函数都添加了 try-catch 错误处理，API 失败时会：
   - 在控制台输出错误日志
   - 返回空数据或默认值，避免页面崩溃
   - 在 UI 操作（订阅、更新状态）中通过 `alert()` 显示错误（后续可改为 Toast 提示）

3. **数据映射**: 后端 DTO 字段名称（如 `strategyInstanceId`）与前端展示类型（如 `Strategy`, `StrategyItem`）不同，通过 `mappers.ts` 中的函数进行转换

4. **待实现功能**: 
   - 持仓数据展示（需要后端接口）
   - 账户统计数据（需要后端接口）
   - 策略性能指标（需要后端接口）
   - 交易所账户选择（需要先实现账户管理功能）

---

## 下一步建议

1. **测试**: 启动后端服务，在前端测试所有修改的功能
2. **完善持仓数据**: 与后端协调，实现持仓查询接口
3. **完善统计数据**: 实现账户统计和策略性能接口
4. **改进错误提示**: 将 `alert()` 替换为更友好的 Toast 组件
5. **添加加载状态**: 在数据请求时显示 Loading 动画
6. **实现交易所账户管理**: 允许用户绑定和选择交易所账户
