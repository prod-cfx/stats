# Auth Verification Service Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract email verification code generation, persistence, and afterCommit mail dispatch from `UserAuthService` into a dedicated auth service while keeping controller API and behavior unchanged.

**Architecture:** Add `VerificationCodeService` beside `UserAuthService`. `UserAuthService` remains the controller-facing facade and delegates `sendVerificationCode`, `sendEmailLoginCode`, `requestPasswordReset`, and `resendVerification`. Data access stays behind `UserAuthRepository`; no schema or API contract changes.

**Tech Stack:** NestJS 11, Jest, Prisma repository boundary, `TransactionEventsService.afterCommit`, `dx` commands.

---

## Files

- Create: `apps/backend/src/modules/auth/services/verification-code.service.ts`
- Create: `apps/backend/src/modules/auth/services/verification-code.service.spec.ts`
- Modify: `apps/backend/src/modules/auth/services/user-auth.service.ts`
- Modify: `apps/backend/src/modules/auth/auth.module.ts`

## Task 1: Characterize Verification Service Behaviors

- [ ] Write `verification-code.service.spec.ts` before production code. Build mocks for `UserAuthRepository`, `ConfigService`, `EnvService`, `MailService`, and `TransactionEventsService`.
- [ ] Cover registration verification success: lowercases email, rejects no existing user, creates `EMAIL_VERIFICATION` code with future expiry, registers one afterCommit callback, and callback sends `registration` mail.
- [ ] Cover registered email failure: repository finds user and service throws `EmailAlreadyTakenException` without creating code or registering afterCommit.
- [ ] Cover password reset missing user: service returns without creating code, sending mail, or logging state.
- [ ] Cover email login success: creates `EMAIL_VERIFICATION` code and afterCommit callback sends `registration` mail.
- [ ] Run red test: `dx test unit backend apps/backend/src/modules/auth/services/verification-code.service.spec.ts`; expected failure is missing `VerificationCodeService`.

## Task 2: Add VerificationCodeService

- [ ] Move verification constants and helpers from `UserAuthService`: `VERIFICATION_CODE_TTL_MINUTES`, `FIXED_VERIFICATION_CODE_FOR_TEST`, `VERIFICATION_CODE_MIN`, `VERIFICATION_CODE_MAX`, `maskEmail`, `generateVerificationCode`, and `addMinutes`.
- [ ] Implement public methods: `sendVerificationCode(dto)`, `sendEmailLoginCode(dto)`, `requestPasswordReset(dto)`, and `resendVerification(dto)`.
- [ ] Inject only `UserAuthRepository`, `ConfigService`, `EnvService`, `MailService`, and `TransactionEventsService`.
- [ ] Preserve current behavior exactly: password reset and resend unknown/verified users silently return; mail I/O stays inside `txEvents.afterCommit`; code generation keeps dev/test fixed code and staging override.
- [ ] Run green test: `dx test unit backend apps/backend/src/modules/auth/services/verification-code.service.spec.ts`.

## Task 3: Delegate UserAuthService Facade

- [ ] Inject `VerificationCodeService` into `UserAuthService`.
- [ ] Replace bodies of `requestPasswordReset`, `sendVerificationCode`, `sendEmailLoginCode`, and `resendVerification` with delegation to `VerificationCodeService`.
- [ ] Remove now-unused `MailService`, `TransactionEventsService`, verification constants, and helper methods from `UserAuthService`.
- [ ] Keep `AuthController` constructor and route method signatures unchanged.
- [ ] Register `VerificationCodeService` in `AuthModule.providers`.
- [ ] Run focused tests: `dx test unit backend apps/backend/src/modules/auth/services/verification-code.service.spec.ts apps/backend/src/modules/auth/services/user-auth.service.beta-code.spec.ts apps/backend/src/modules/auth/auth.controller.spec.ts`.

## Task 4: Verify and Ship

- [ ] Run required parallel verification: `dx lint`, `dx build backend --dev`, and affected unit tests.
- [ ] Fix failures by root cause, then rerun all three verification lanes.
- [ ] Commit on `codex/refactor/2477-auth-verification-service` with Conventional Commit and `Refs: #2477`.
- [ ] Push and create one PR with title `refactor: extract auth verification code service`; body includes `Closes: #2477`.

## Self-Review

- Spec coverage: all #2477 acceptance criteria map to Tasks 1-4.
- Placeholder scan: no TBD/TODO placeholders.
- Type consistency: service names and method signatures match existing DTO names and facade methods.
