# Telegram 网页登录改造设计（统一样式 + 一键发起）

## 1. 背景
当前登录页左侧“Telegram 网页版”使用 `telegram-widget.js` 注入官方按钮，样式被 Telegram 控制，无法与右侧“Telegram 桌面应用”按钮保持一致。

## 2. 目标
1. 左右 Telegram 按钮视觉完全一致（尺寸、边框、色值、圆角、字体、图标、交互态）。
2. 左侧点击后“一键发起登录”，并通过 Telegram 官方授权链路完成登录。
3. 回调后自动完成登录并跳转，无需用户二次手动操作页面按钮。

## 3. 非目标
1. 不绕过 Telegram 官方授权与签名校验机制。
2. 不改桌面登录主链路逻辑。
3. 不引入新的 UI 框架或第三方授权 SDK。

## 4. 方案结论
采用方案：**移除官方 widget，改为自定义 Telegram Web 按钮 + OAuth 跳转授权**。

- 不再注入 `https://telegram.org/js/telegram-widget.js`。
- 左侧按钮使用本项目自定义样式体系，和右侧按钮复用同一套样式。
- 点击后先向后端获取 `authorizeUrl`，再跳转 Telegram 授权。
- 授权回调仍落到现有 `/{lng}/auth/telegram/callback` 页面，复用现有登录交换逻辑。

## 5. 组件与接口设计

### 5.1 前端组件
文件：`apps/front/src/features/auth/components/telegram-login-buttons.tsx`

改造要点：
1. 删除 `scriptHostRef` 与 widget 注入逻辑。
2. 增加 `webBusy` 状态，点击左侧按钮后禁用，防止重复提交。
3. 左侧按钮样式复用右侧按钮样式规范（边框、色值、图标风格一致）。
4. 继续使用 `statusMessage` 展示错误反馈。

### 5.2 前端 API
文件：`apps/front/src/features/auth/api.ts`

新增请求：
- `getTelegramWebAuthorizeUrl(params)`
  - 输入：`intent`、`lng`、`redirect`（可选）
  - 输出：`authorizeUrl`

### 5.3 后端接口
建议新增：
- `GET /auth/telegram/web/authorize-url`
  - 负责拼接并返回 Telegram 官方授权地址
  - 附带 `state/nonce` 等安全参数

现有回调交换接口继续使用（登录/绑定链路保持不变），并保证：
1. `state` 校验
2. 签名与时效校验
3. 失败时返回可读错误码与信息

## 6. 页面流转
1. 用户点击“Telegram 网页版”按钮。
2. 前端请求后端获取 `authorizeUrl`。
3. 前端跳转 Telegram 授权页。
4. Telegram 回调到 `/{lng}/auth/telegram/callback?source=web&intent=...`。
5. 回调页完成交换并自动登录，随后跳转目标页。

## 7. 异常处理
1. `authorizeUrl` 为空或接口失败：提示“Telegram 网页登录暂不可用，请稍后重试”。
2. 用户取消授权：提示“授权未完成，请重试”。
3. `state` 无效/过期：提示“授权状态失效，请重新发起登录”。
4. 签名校验失败：提示“授权参数无效，请重试”。
5. 网络错误：统一错误提示，不泄露内部细节。

## 8. 验收标准
1. 左右 Telegram 按钮视觉一致。
2. 不再出现 Telegram 官方蓝色内嵌按钮样式。
3. 首次用户可完成：点击 -> Telegram 授权 -> 自动回调登录。
4. 已授权用户链路更短，感知接近“一键登录”。
5. 异常场景下有明确提示，页面不卡死。

## 9. 风险与约束
1. 首次登录必须经过 Telegram 授权确认，无法实现绝对站内无授权登录。
2. Telegram 授权页交互受官方控制，页面文案/步骤不可完全自定义。

## 10. 实施范围（最小变更）
1. `apps/front/src/features/auth/components/telegram-login-buttons.tsx`
2. `apps/front/src/features/auth/api.ts`
3. 后端 auth 模块新增 `authorize-url` 端点与安全校验（如未存在）。
4. i18n 文案补充（错误提示与按钮文案如有需要）。
