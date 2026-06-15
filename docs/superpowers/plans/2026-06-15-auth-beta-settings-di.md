# Auth Beta Settings DI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove circular `forwardRef()` wiring between `AuthModule`, `BetaCodeModule`, and `SettingsModule` while preserving auth, beta code, and settings behavior.

**Architecture:** Keep one explicit dependency chain: `AuthModule -> BetaCodeModule -> SettingsModule`. `BetaCodeModule` and `SettingsModule` controllers may import auth decorators and RBAC constants as TypeScript symbols, but their Nest modules must not import `AuthModule` because guards are resolved by the app-level auth module wiring.

**Tech Stack:** NestJS 11 modules/providers, Jest unit specs, dx/Nx backend commands.

---

## Files

- Modify: `apps/backend/src/modules/auth/auth.module.ts` — remove `forwardRef` import/use and import `BetaCodeModule` directly.
- Modify: `apps/backend/src/modules/beta-code/beta-code.module.ts` — remove `AuthModule` import and import `SettingsModule` directly.
- Modify: `apps/backend/src/modules/settings/settings.module.ts` — remove `AuthModule` import completely.
- Create: `apps/backend/src/modules/auth/auth-beta-settings.module.spec.ts` — provider assembly regression test for the three modules without module-level `forwardRef`.

## Tasks

### Task 1: Add provider assembly regression test

- [ ] Write `apps/backend/src/modules/auth/auth-beta-settings.module.spec.ts` with a focused static module metadata test that imports the three module classes and verifies no module import is a `forwardRef` wrapper.
- [ ] Run `dx test unit backend apps/backend/src/modules/auth/auth-beta-settings.module.spec.ts` and confirm it fails because existing metadata contains forwardRef wrappers.

### Task 2: Remove circular module imports

- [ ] In `auth.module.ts`, change `import { forwardRef, Module } from '@nestjs/common'` to `import { Module } from '@nestjs/common'` and replace `forwardRef(() => BetaCodeModule)` with `BetaCodeModule`.
- [ ] In `beta-code.module.ts`, remove the `AuthModule` import, change `import { forwardRef, Module } from '@nestjs/common'` to `import { Module } from '@nestjs/common'`, and replace the imports array with `[PrismaModule, SettingsModule]`.
- [ ] In `settings.module.ts`, remove the `AuthModule` import, change `import { forwardRef, Module } from '@nestjs/common'` to `import { Module } from '@nestjs/common'`, and replace the imports array with `[PrismaModule, CacheModule]`.
- [ ] Run `rg -n "forwardRef" apps/backend/src/modules/auth apps/backend/src/modules/beta-code apps/backend/src/modules/settings` and confirm no matches in the three target modules.

### Task 3: Verify behavior and build surface


- [ ] Run the related specs one path at a time because `dx test unit backend` accepts one path argument: `dx test unit backend apps/backend/src/modules/auth/auth-beta-settings.module.spec.ts`, `dx test unit backend apps/backend/src/modules/auth/services/user-auth.service.beta-code.spec.ts`, `dx test unit backend apps/backend/src/modules/beta-code/services/beta-code.service.spec.ts`, `dx test unit backend apps/backend/src/modules/beta-code/controllers/admin-beta-code.controller.spec.ts`, and `dx test unit backend apps/backend/src/modules/settings/exceptions`.
- [ ] Run `dx lint` and confirm pass.
- [ ] Run `dx build backend --dev` and confirm pass.

## Commit

```bash
git add apps/backend/src/modules/auth/auth.module.ts \
  apps/backend/src/modules/beta-code/beta-code.module.ts \
  apps/backend/src/modules/settings/settings.module.ts \
  apps/backend/src/modules/auth/auth-beta-settings.module.spec.ts \
  docs/superpowers/plans/2026-06-15-auth-beta-settings-di.md \
  .omc/plans/auth-beta-settings-di-critic-round1.md
git commit -F - <<'MSG'
refactor: remove auth beta settings module cycles

变更说明：
- 将 Auth/BetaCode/Settings 模块装配改为单向依赖，删除 forwardRef。
- 增加模块 metadata 回归测试，防止循环依赖重新引入。

Closes: #2494
MSG
```
