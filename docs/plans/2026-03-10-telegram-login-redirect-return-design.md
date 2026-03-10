# Telegram 登录回跳 redirect 修复设计

## 背景
当前登录页向 `TelegramLoginButtons` 传入了 `redirect`，但按钮组件内部没有透传该参数到 Telegram 登录链路，导致“登录后回到用户登录前页面”的预期可能失效。

目标行为：
- 登录成功后优先跳回用户登录前页面（`redirect`）。
- 当 `redirect` 丢失或非法时，兜底跳转到 `/${lng}/account`。

## 方案对比

### 方案 A（采用）
继续使用 URL 中的 `redirect`，并在 Telegram Web/Desktop 两条链路中完整透传，在 callback 解析层统一做站内路径校验。

优点：
- 改动范围小，兼容现有流程。
- 行为统一，易于排查。

缺点：
- 需要分别覆盖 Web 与 Desktop 参数透传。

### 方案 B
使用 `sessionStorage` 保存回跳地址。

缺点：
- 跨窗口/跨设备不可靠，不适合 Telegram 外跳流程。

### 方案 C
新增统一 `returnTo` 中间层。

缺点：
- 当前属于过度设计，超出本次修复边界。

## 设计细节

### 1. 参数透传
- `TelegramLoginButtons` 接收 `redirect?: string`。
- Web 登录：请求 `authorize-url` 时传入 `redirect`，确保 Telegram 回调包含该值。
- Desktop 登录：创建 desktop intent 时传入 `redirect`，并确保 `callbackUrl` 带上该值。

### 2. 回调解析与安全校验
- 在 `resolveTelegramCallbackPayload` 中继续解析 `redirect`。
- `normalizeRedirect` 规则：
  - 仅允许以 `/` 开头的站内路径。
  - 其余情况统一降级为 `/${lng}/account`。

### 3. 跳转行为
- Telegram 登录成功后统一 `router.replace(normalizedRedirect)`。
- `intent=bind` 场景沿用同一规则：有合法 `redirect` 则回跳，否则回账户页。

## 错误处理
- 授权失败、超时、参数缺失继续使用现有错误提示，不改变交互文案。
- `redirect` 非法时仅做静默降级，不额外报错。

## 验收标准
1. 访问 `/${lng}/auth/login?redirect=/${lng}/ai-quant`，Telegram 登录成功后回到 `/${lng}/ai-quant`。
2. 访问 `/${lng}/auth/login?redirect=https://evil.com`，登录成功后回到 `/${lng}/account`。
3. 不传 `redirect`，登录成功后回到 `/${lng}/account`。
4. 本次改动不引入新的登录链路 type-check 报错。

## 影响范围
- `apps/front/src/features/auth/components/telegram-login-buttons.tsx`
- `apps/front/src/features/auth/api.ts`
- `apps/front/src/features/auth/telegram-callback-params.ts`
- `apps/front/src/app/[lng]/auth/telegram/callback/page.tsx`
