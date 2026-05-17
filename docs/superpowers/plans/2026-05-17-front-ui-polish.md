# Front UI Polish Implementation Plan

**Goal:** 收拢本轮前端 UI 细节优化，提升登录、账户、策略广场、策略详情和账户菜单的一致性与紧凑度。
**Track:** B
**Issue:** #1453

## Scope

- 登录入口和登录框：优化导航登录按钮、收窄登录框、调整 Telegram 登录入口布局和文案。
- 账户页：头像改为稳定本地 identicon；邮箱默认脱敏并提供显隐按钮；账户菜单去掉多余分隔线。
- 策略广场/策略详情：返回按钮文案和样式回归确认稿；策略实例 ID 缩短显示但保留完整复制能力。
- 策略列表：调小标题层级、统一 OKX 元信息色阶。

## Files

- `apps/front/src/components/layout/Navbar.tsx`
- `apps/front/src/app/[lng]/auth/login/LoginPageClient.tsx`
- `apps/front/src/features/auth/components/TelegramLoginButtons.tsx`
- `apps/front/src/app/[lng]/account/AccountPageClient.tsx`
- `apps/front/src/components/account/UserAvatar.tsx`
- `apps/front/src/components/account/AiQuantStrategyList.tsx`
- `apps/front/src/components/account/AiQuantStrategyDetail.tsx`
- `apps/front/src/app/[lng]/ai-quant/plaza/PlazaPageClient.tsx`
- `apps/front/public/locales/zh/common.json`
- `apps/front/public/locales/en/common.json`
- Focused tests beside touched components.

## Tasks

1. Audit current diff and keep only requested UI changes.
2. Ensure copy and visual hierarchy match `docs/decisions/front-ui-optimization-standard.md`.
3. Run focused lint and unit tests for touched UI surfaces.
4. Open PR with issue link and validation notes.

## Verify

- `eslint` focused touched frontend files.
- `dx test unit front AccountPageClient.test.tsx`
- `dx test unit front UserAvatar.test.tsx`
- `dx test unit front PlazaPageClient.test.tsx`
- `dx test unit front AiQuantStrategyDetail.test.tsx`
- JSON parse for `zh/common.json` and `en/common.json`.

## Commit

- Single PR, commit references issue.
