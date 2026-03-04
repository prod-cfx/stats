# Telegram Desktop Start Param 丢失修复设计

## 1. 背景
生产环境中点击“Telegram 桌面应用”后会自动打开 Telegram 客户端，但会话中只有 `/start`，缺失 `tg_login_xxx` 参数，导致后端无法确认 desktop intent，页面长期停留在“正在验证签名/等待跳转”。

## 2. 问题定位
当前桌面登录按钮优先跳转 `deepLink (tg://resolve?domain=...&start=tg_login_xxx)`，部分 Telegram 客户端/系统环境会丢失 `start` 参数，造成授权链路断裂。

## 3. 目标
1. 确保桌面登录入口稳定携带 `start=tg_login_xxx` 参数。
2. 保持现有 desktop intent 回调轮询机制不变。
3. 不影响 Web 登录链路。

## 4. 方案结论
采用“**优先 webLink**”策略：
- 点击“Telegram 桌面应用”后，优先跳 `https://t.me/<bot>?start=tg_login_xxx`（即 `result.webLink`）。
- 保留现有 callback 页轮询 `desktop_intent` 的处理。

该方案对 `start` 参数兼容性更高，能显著降低客户端对 `tg://` 参数解析差异导致的丢参问题。

## 5. 实施范围
- 前端：
  - `apps/front/src/features/auth/components/telegram-login-buttons.tsx`
- 回归确认（不一定改代码）：
  - `apps/front/src/app/[lng]/auth/telegram/callback/page.tsx`

## 6. 行为细节
按钮点击流程：
1. 调用 `createTelegramDesktopIntent` 获取 `intentId / webLink / callbackUrl`。
2. 直接 `window.location.href = result.webLink`。
3. 现有 callback 页继续基于 `desktop_intent` 轮询状态，确认后自动登录。

## 7. 异常处理
1. intent 创建失败：沿用现有错误提示。
2. 用户未授权或超时：沿用 callback 页超时提示。
3. intent 过期：沿用现有“重建 intent 并重试”逻辑。

## 8. 验收标准
1. Telegram 会话中应看到 `/start tg_login_xxx`，而非仅 `/start`。
2. 授权后可自动回调并完成登录。
3. 不影响“Telegram 网页版”登录。
4. 不影响 desktop callback 轮询与过期重建逻辑。
