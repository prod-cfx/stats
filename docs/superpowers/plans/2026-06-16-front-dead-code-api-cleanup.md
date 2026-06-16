# Front Dead Code API Cleanup Implementation Plan

> **For agentic workers:** Track B plan for issue #2541. Execute task-by-task and keep react-doctor output as the source of truth for removal counts.

**Goal:** Remove confirmed unused `apps/front/src/**` files and shrink `apps/front/src/lib/api.ts` exports so react-doctor dead-code output reflects real remaining work.

**Track:** B
**Issue:** #2541

**Architecture:** Keep runtime API call sites unchanged unless a removed aggregate export proves unused. Treat `apps/front/src/lib/api.ts` as a compatibility barrel for actively imported front symbols only. Delete scaffold-era files with no Next route, static import, dynamic import, test, or string entry.

**Tech Stack:** Next.js front app, TypeScript, react-doctor, `dx` verification.

---

## Files

- Modify: `apps/front/src/lib/api.ts` — remove unused aggregate exports, type definitions, and stub functions reported by react-doctor.
- Delete candidates after reference check:
  - `apps/front/src/app/LandingPageBackup.tsx`
  - `apps/front/src/services/home-service.ts`
  - `apps/front/src/services/sdk-client.ts`
  - `apps/front/src/types/competition.ts`
  - `apps/front/src/types/home.ts`
  - `apps/front/src/lib/api-errors.ts`
  - `apps/front/src/lib/constants.ts`
  - `apps/front/src/lib/error-messages.ts`
- Add/modify: `.omc/plans/front-dead-code-api-cleanup-critic-round1.md` — critic artifact.

## Steps

### Task 1: Baseline Dead-Code Scan

- [x] Run react-doctor full offline scan with the current CLI syntax:
  `npx react-doctor apps/front --diff false --offline --json --fail-on none > /tmp/react-doctor-2541-baseline.json`
- [x] Extract unused file / export / type entries for `apps/front/src/lib/api.ts` and issue-listed files.
- [x] If issue command syntax differs from installed CLI, record the fallback in PR body.

### Task 2: Confirm File Deletions

- [x] For every issue-listed unused file, confirm no static imports, dynamic imports, route conventions, tests, or string references using `rg`.
- [x] Delete files with no runtime or test entry.
- [x] If any file has a real entry, keep it and document the reason in PR body instead of suppressing broadly.

### Task 3: Prune `src/lib/api.ts`

- [x] Remove unused standalone exports reported by react-doctor, starting with LLM strategy/subscription stubs if no imports exist.
- [x] Remove unused types/interfaces only when no front import exists and no kept exported type depends on them.
- [x] Preserve domain re-exports and active types used by front components/tests.
- [x] Avoid moving call sites unless a removed symbol has an active consumer; this issue is cleanup, not API migration.

### Task 4: Re-Scan and Iterate

- [x] Re-run react-doctor with the same fallback command.
- [x] Confirm the three named unused files no longer appear.
- [x] Confirm `apps/front/src/lib/api.ts` unused exports <= 10 and unused types <= 10, or list every retained symbol with reason.

### Task 5: Parallel Verification

- [x] Run three independent verification commands concurrently from repo root:
  - `dx lint`
  - `dx build front --dev`
  - `dx test unit front`
- [x] If any fail, fix and re-run all three commands concurrently.

React Doctor note: installed CLI no longer supports the issue's `--full` / `--fail-on none` flags. Fallback `npx react-doctor . --project apps/front --scope full --json --blocking none --no-telemetry` completed with exit 0, but its dead-code worker timed out after 120s. The resulting report contained no target hits for `LandingPageBackup.tsx`, `home-service.ts`, `sdk-client.ts`, or `src/lib/api.ts`; static import matrix found zero unused exports remaining from `@/lib/api` consumers.

## Verify

- `npx react-doctor apps/front --diff false --offline --json --fail-on none`
- `dx lint`
- `dx build front --dev`
- `dx test unit front`

## Commit

Use one commit:

```bash
git add apps/front/src docs/superpowers/plans/2026-06-16-front-dead-code-api-cleanup.md .omc/plans/front-dead-code-api-cleanup-critic-round1.md
git commit -F - <<'MSG'
chore: prune front dead code exports

变更说明：
- 删除确认无入口的 front scaffold dead code 文件
- 收敛 src/lib/api.ts 只保留仍被 front 使用的聚合导出和类型

Refs: #2541
MSG
```
