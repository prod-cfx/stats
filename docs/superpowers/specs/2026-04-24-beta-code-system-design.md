# 内测码系统设计

## 背景

项目计划在 5 月中旬开放对外公测，需要在现有用户系统上增加内测码准入能力。目标是控制新用户进入规模，同时不影响已有用户继续登录和使用。

现有后端在 `apps/backend` 中承担用户认证、后台账户、RBAC 和 OpenAPI 合约导出；用户端在 `apps/front`，管理后台在 `apps/admin-front`。用户表已有 `invitation_code` 和 `inviter_id` 字段，但当前注册、邮箱验证码自动注册、Telegram 自动注册流程未消费邀请码。

## 核心决策

首版采用“独立内测码模块 + 首次创建用户时兑换”的设计。

- 只限制新用户首次创建账号。
- 已有用户邮箱登录、Telegram 登录不需要内测码。
- 内测码由管理后台批量生成。
- 每个内测码可配置可用次数。
- 内测码和用户邀请关系分离，首版不使用 `inviter_id`。
- 兑换成功后把用户使用的内测码写入 `users.invitation_code`，保留现有字段价值。

## 非目标

首版不实现以下能力：

- 过期时间。
- 渠道、备注、批次筛选。
- 兑换详情页。
- IP、User-Agent、操作审计。
- 用户互邀裂变。
- 删除内测码。
- 已有账号补填内测码或登录后准入拦截。

## 架构

在 `apps/backend` 新增 `BetaCodeModule`，遵循现有三层架构：

- Controller：声明 HTTP 接口、鉴权、DTO 验证、事务边界。
- Service：封装批量生成、列表查询、启停、兑换规则。
- Repository：封装 Prisma 访问，并通过 `TransactionHost` 参与事务。

`AuthService` 只在“即将创建新用户”时调用 `BetaCodeService` 的兑换方法，不直接访问内测码数据表。

## 数据模型

新增 `beta_access_codes`：

- `id`: string，主键。
- `code`: string，唯一，存归一化后的内测码。
- `max_uses`: int，最多可用次数。
- `used_count`: int，已使用次数，默认 0。
- `is_active`: boolean，是否启用，默认 true。
- `created_by_admin_id`: string nullable，创建管理员 ID。
- `created_at`: datetime。
- `updated_at`: datetime。

新增 `beta_access_code_redemptions`：

- `id`: string，主键。
- `code_id`: string，关联 `beta_access_codes.id`。
- `user_id`: string，关联 `users.id`。
- `created_at`: datetime。

约束与索引：

- `beta_access_codes.code` 唯一。
- `beta_access_code_redemptions.user_id` 唯一，保证一个用户只兑换一次内测码。
- `beta_access_code_redemptions.code_id` 建索引，便于后续扩展查看使用记录。

## 内测码格式

复用 `@ai/shared` 中现有邀请码工具的约束：

- 最大长度 64。
- 字符集为大小写字母、数字、下划线、连字符。
- 入库前 trim 并归一化。

批量生成默认使用不易混淆的随机大写字母数字组合，例如 12 到 16 位。生成时如果发生唯一冲突，重新生成该条码，直到满足请求数量。

## 兑换规则

兑换发生在创建新用户的同一事务内。

流程：

1. 校验请求携带内测码。
2. 归一化内测码。
3. 查询内测码是否存在。
4. 如果不存在，抛出 `BETA_CODE_INVALID`。
5. 如果已停用，抛出 `BETA_CODE_DISABLED`。
6. 使用条件更新递增 `used_count`：仅当 `is_active = true` 且 `used_count < max_uses` 时更新成功。
7. 如果条件更新未命中，重新判断并抛出 `BETA_CODE_EXHAUSTED` 或 `BETA_CODE_DISABLED`。
8. 创建兑换记录。
9. 更新 `users.invitation_code` 为该内测码。

并发一致性由条件更新保证，避免多个请求同时消费最后一个名额导致超卖。

## 注册接入

以下接口增加可选内测码字段，字段名固定为 `betaCode`，并在 OpenAPI 合约中导出：

- `POST /auth/register`
- `POST /auth/email/verify-code`
- `POST /auth/telegram/exchange`
- `POST /auth/telegram/desktop/exchange`

行为：

- 如果接口会创建新用户，必须提供有效内测码。
- 如果用户已存在并只是登录，不要求内测码。
- 原有密码登录、邮箱绑定、Telegram 绑定不受影响。

邮箱验证码登录：

- 邮箱不存在时，验证验证码成功后创建用户，并兑换内测码。
- 邮箱已存在时，验证验证码成功后直接登录。

Telegram 登录：

- Telegram credential 已存在时直接登录。
- Telegram credential 不存在时创建用户，并兑换内测码。

## 后台 API

新增 admin API，路径固定为 `admin/beta-codes`：

- `GET /admin/beta-codes`
  - 分页列表。
  - 返回 `id`、`code`、`maxUses`、`usedCount`、`isActive`、`createdAt`。
- `POST /admin/beta-codes/batch`
  - 批量生成。
  - 参数：`count`、`maxUsesPerCode`。
  - 返回本批生成的完整内测码列表。
- `PUT /admin/beta-codes/:id/status`
  - 启用或停用。
  - 参数：`isActive`。

首版不提供删除接口。已经分发出去的码通过停用失效，避免数据消失带来排查困难。

## 权限

新增后台权限资源 `BETA_CODE`，语义独立于已有 `INVITATION`。

权限编码固定为：

- `admin:beta-code:read`
- `admin:beta-code:create`
- `admin:beta-code:update`

Controller 使用现有 `RequireAuth`、`ReadAny`、`CreateAny`、`UpdateAny` 装饰器保护接口。

seed 中新增菜单，放入现有 `system` 目录：

- code: `beta.access-codes`
- title: `内测码`
- path: `/beta-codes`
- parentCode: `system`

超级管理员 seed 默认拥有该菜单权限。

## 管理后台

在 `apps/admin-front` 新增 `/beta-codes` 页面，并在 protected layout 的 `NAV_ITEMS` 中增加“内测码”入口。

页面能力：

- 顶部按钮“批量生成”。
- 弹窗输入生成数量。
- 弹窗输入每个码可用次数。
- 生成成功后展示本批生成结果。
- 支持一键复制本批内测码。
- 主列表展示内测码、状态、已用/总量、创建时间、操作。
- 操作为启用/停用。

页面风格沿用现有 Ant Design 管理后台，避免新设计体系。

## 用户端

在 `apps/front` 登录页增加“内测码”输入框。

文案：

- 字段名：`内测码`。
- 辅助说明：`首次登录需要内测码`。

邮箱验证码登录：

- 发送验证码不需要内测码。
- 验证验证码并登录时传 `betaCode`。
- 已有邮箱用户即使未填写内测码也可以登录。

Telegram 登录：

- 点击 Telegram 登录前要求填写内测码。
- Web Telegram 回调需要保留这次登录意图的内测码。
- Desktop Telegram intent 创建时携带或缓存内测码，exchange 时传给后端。

这样首次 Telegram 用户不会在回调页才发现缺少内测码。

## 错误处理

新增共享错误码：

- `BETA_CODE_REQUIRED`
- `BETA_CODE_INVALID`
- `BETA_CODE_EXHAUSTED`
- `BETA_CODE_DISABLED`

所有业务错误使用 `DomainException`。前端首版可以直接展示后端返回消息，不新增复杂映射。

## 测试

后端测试：

- 批量生成会创建指定数量的码。
- 每个码的 `maxUses` 正确。
- 停用码不可兑换。
- 次数耗尽后不可兑换。
- 并发兑换不会超过 `maxUses`。
- 新用户无内测码注册失败。
- 新用户错误内测码注册失败。
- 新用户有效内测码注册成功，并写入 `users.invitation_code`。
- 已有邮箱用户验证码登录不需要内测码。
- 已有 Telegram 用户登录不需要内测码。

管理后台测试：

- 批量生成调用正确 API 并展示本批结果。
- 启用/停用调用正确 API。
- 列表展示已用/总量。

用户端测试：

- 邮箱验证码登录会传 `betaCode`。
- Telegram 登录前缺少内测码会阻止发起。
- Telegram 回调或 desktop exchange 能保留并传递内测码。

合约与构建：

- 后端 DTO/API 变更后重新生成 `packages/api-contracts`。
- 后端改动运行相关 E2E 或单测。
- 前端和管理后台改动运行对应单测。

## 兼容性

该设计不改变已有用户的登录条件。只有创建新用户的路径新增内测码要求，符合公测前控量目标，也符合“不破坏已有用户”的约束。

## 后续扩展

后续可在不破坏首版模型的基础上增加：

- 批次号。
- 渠道来源。
- 备注。
- 过期时间。
- 兑换详情页。
- 使用用户列表。
- 操作审计。
- 用户邀请码和邀请关系。
