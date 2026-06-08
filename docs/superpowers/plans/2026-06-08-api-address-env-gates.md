# API Address Env Gates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make frontend, admin, backend-to-quantify, and quantify-to-backend API address configuration fail at dx/config validation instead of falling back to localhost at runtime.

**Architecture:** Keep a single PR because the change is a coherent configuration contract with no runtime data dependency. Add focused tests around config policy and URL resolvers, then remove unguarded localhost fallbacks and align env templates with policy.

**Tech Stack:** TypeScript, Jest, Node.js check scripts, dx environment policy JSONC.

---

### Task 1: Policy and Resolver Tests

**Files:**
- Create: `dx/config/env-policy.spec.ts`
- Modify: `apps/front/src/lib/api-client.ts`
- Create: `apps/front/src/lib/api-client.test.ts`
- Modify: `apps/front/src/lib/ws.ts`
- Create: `apps/front/src/lib/ws.test.ts`
- Modify: `apps/admin-front/src/lib/api-base-url.test.ts`
- Modify: `apps/quantify/src/common/auth/backend-api-base-url.spec.ts`
- Create: `apps/backend/src/common/clients/quantify-contract.shared.spec.ts`

- [ ] Write failing tests that require `frontend.required._common` to include `APP_ENV`, `NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_BACKEND_API_BASE_URL`, and `NEXT_PUBLIC_WS_URL`.
- [ ] Write failing tests that every committed `.env.{development,staging,production,test,e2e}` has a non-placeholder `NEXT_PUBLIC_BACKEND_API_BASE_URL` ending with `/api/v1`.
- [ ] Write failing tests that `front` server URL resolution rejects missing `NEXT_PUBLIC_BACKEND_API_BASE_URL` instead of using localhost.
- [ ] Write failing tests that `front` WebSocket URL rejects missing public URLs instead of using localhost.
- [ ] Update existing admin tests so both public API vars missing/placeholder throws.
- [ ] Update quantify backend URL tests so missing backend API config throws.
- [ ] Add backend quantify URL tests so missing quantify API config throws.

### Task 2: Implementation

**Files:**
- Modify: `dx/config/env-policy.jsonc`
- Modify: `.env.development`, `.env.staging`, `.env.production`, `.env.test`, `.env.e2e`, `.env.example`
- Modify: `apps/front/src/lib/api-client.ts`, `apps/front/src/lib/ws.ts`
- Modify: `apps/admin-front/src/lib/api-base-url.ts`
- Modify: `apps/quantify/src/common/auth/backend-api-base-url.ts`
- Modify: `apps/backend/src/common/clients/quantify-contract.shared.ts`

- [ ] Add frontend common required vars in `dx/config/env-policy.jsonc`.
- [ ] Replace placeholder public API base values in committed env files with explicit local/test/staging paths.
- [ ] Keep `NEXT_PUBLIC_QUANTIFY_API_BASE_URL` as optional because current frontend/admin code has no active consumer.
- [ ] Make front SSR server base require `NEXT_PUBLIC_BACKEND_API_BASE_URL` as a complete URL including `/api/v1`.
- [ ] Make front WebSocket base require `NEXT_PUBLIC_WS_URL` or derive origin from `NEXT_PUBLIC_BACKEND_API_BASE_URL`.
- [ ] Keep admin on `NEXT_PUBLIC_BACKEND_API_BASE_URL`; throw when it is missing or placeholder.
- [ ] Make quantify-to-backend and backend-to-quantify helpers throw on missing or placeholder config.

### Task 3: Verification and PR

**Files:**
- All files above.

- [ ] Run focused tests: admin/front/backend/quantify resolver tests and config policy test.
- [ ] Run `dx lint`.
- [ ] Run affected builds: `dx build front --dev`, `dx build admin --dev`, `dx build backend --dev`, `dx build quantify --dev`.
- [ ] Commit with `Refs: #2349`, push, and create PR body with verification evidence and `Closes: #2349`.
