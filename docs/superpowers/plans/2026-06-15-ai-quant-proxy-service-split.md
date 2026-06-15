# AI Quant Proxy Service Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split account strategies and LLM strategy proxy responsibilities out of `AiQuantProxyService` while preserving backend route behavior and quantify client boundaries.

**Architecture:** Keep `AiQuantProxyService` as a stable facade for controllers. Move account strategy methods into `AccountAiQuantStrategiesProxyService`, LLM instance methods into `LlmStrategyInstancesProxyService`, and LLM subscription methods into `LlmStrategySubscriptionsProxyService`. Share header and error mapping through a local `AiQuantProxySupportService` so sub services still use `QuantifyAiQuantClient` as the only HTTP boundary.

**Tech Stack:** NestJS 11, TypeScript, Jest, existing `dx` commands.

---

## Files

- Create: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy-support.service.ts` for common header builders and quantify error mapping.
- Create: `apps/backend/src/modules/ai-quant-proxy/account-ai-quant-strategies-proxy.service.ts` for account strategy list/detail/action/deploy/delete/leverage/deploy-result methods.
- Create: `apps/backend/src/modules/ai-quant-proxy/llm-strategy-instances-proxy.service.ts` for LLM instance list/detail/signals methods.
- Create: `apps/backend/src/modules/ai-quant-proxy/llm-strategy-subscriptions-proxy.service.ts` for LLM subscription create/list/detail/update/cancel methods.
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.ts` to delegate those methods and retain existing codegen/conversation/strategy plaza/backtesting behavior.
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.module.ts` to register new providers.
- Modify: `apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts` to instantiate facade with sub services and add direct sub-service mapping tests.

## Tasks

### Task 1: Add RED tests for new service boundaries

- [ ] Add imports for the three new proxy services and support service to `ai-quant-proxy.service.spec.ts`.
- [ ] Update `createService()` to construct the support service and sub services, then pass the sub services into `AiQuantProxyService`.
- [ ] Add tests that call `AccountAiQuantStrategiesProxyService.listAccountStrategies`, `LlmStrategyInstancesProxyService.listLlmInstances`, and `LlmStrategySubscriptionsProxyService.createLlmSubscription` directly and assert quantify client parameter mapping.
- [ ] Run `dx test unit backend apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`; expect TypeScript import failures because new services do not exist yet.

### Task 2: Extract support and account strategy proxy service

- [ ] Create `AiQuantProxySupportService` with `userHeaders`, `proxyHeaders`, `userProxyHeaders`, `mapQuantifyError`, `mapBacktestingJobError`, `isTransientUpstreamFailure`, and `describeError` helpers copied from the facade.
- [ ] Create `AccountAiQuantStrategiesProxyService` with account strategy methods copied from the facade, including exchange-account validation, deploy retry/backoff, deploy-result reconciliation, and support-based error mapping.
- [ ] Replace account strategy method bodies in `AiQuantProxyService` with delegation to the account strategy service.
- [ ] Run the focused unit test and fix only account-strategy failures.

### Task 3: Extract LLM strategy proxy services

- [ ] Create `LlmStrategyInstancesProxyService` and move `listLlmInstances`, `getLlmInstanceDetail`, and `listLlmInstanceSignals`.
- [ ] Create `LlmStrategySubscriptionsProxyService` and move `createLlmSubscription`, `listLlmSubscriptions`, `getLlmSubscriptionDetail`, `updateLlmSubscription`, and `cancelLlmSubscription`.
- [ ] Replace LLM method bodies in `AiQuantProxyService` with delegation to the two LLM services.
- [ ] Register `AiQuantProxySupportService` and all three sub services in `AiQuantProxyModule.providers`.
- [ ] Run the focused unit test and fix remaining failures.

### Task 4: Verify full affected backend surface

- [ ] Run `dx lint`.
- [ ] Run `dx build backend --dev`.
- [ ] Run `dx test unit backend apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`.
- [ ] If any command fails, fix the issue and rerun all three commands in parallel.

## Verify

- `dx lint`
- `dx build backend --dev`
- `dx test unit backend apps/backend/src/modules/ai-quant-proxy/ai-quant-proxy.service.spec.ts`

## Commit

```bash
git add apps/backend/src/modules/ai-quant-proxy docs/superpowers/plans/2026-06-15-ai-quant-proxy-service-split.md .omc/plans/ai-quant-proxy-service-split-critic-round1.md
git commit -F - <<'MSG'
refactor: split ai quant proxy services

变更说明：
- 拆出 account strategies 与 LLM strategy proxy 子 service，降低 AiQuantProxyService 职责集中度。
- 保留 facade 与 quantify client 边界，补充子 service 参数映射单测。

Refs: #2480
MSG
```
