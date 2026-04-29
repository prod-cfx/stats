# AI Quant Contract Grid Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build real OKX demo spot/perp grid trading from AI Quant conversations without using families, strategy-type branches, or atom string keys as the compilation authority.

**Architecture:** Keep the existing conversation pipeline intact: `SemanticState -> normalized intent -> CanonicalSpecV2 -> IR -> AST -> published snapshot -> deploy`. Add structured atom contracts, compile contract combinations into `levelSets + orderPrograms`, and route deployed ASTs with `orderPrograms` into a new `grid-runtime` subsystem. Ordinary `decisionPrograms` continue to use the existing signal runtime.

**Tech Stack:** NestJS 11, Prisma 7, TypeScript 5.9, Jest, existing `dx` commands, Quantify modules under `apps/quantify/src/modules`, shared script runtime under `packages/shared`.

---

## Scope Check

This is one feature chain, but it spans four implementation bands. Do not try to land the runtime before the semantic and compiler contracts are testable.

1. Contract spine: semantic types, contract normalization, compileability.
2. Compiler spine: CanonicalSpecV2, IR, AST, invariant checks.
3. Runtime spine: grid tables, repository, service, OKX order sync.
4. Integration spine: deploy routing, API, regression tests.

The first mergeable milestone is contract + compiler support that can publish an AST containing `orderPrograms` without starting real grid execution.

---

## File Structure

### Semantic and Contract Spine

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
  - Add structured `SemanticAtomContract`, `SemanticCapability`, `SemanticRequirement`, `SemanticEffect` types.
  - Add optional `contracts` to trigger/action/risk/position/context-bearing semantic nodes.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
  - Allow LLM/tool patches to carry structured contracts.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-contract.service.ts`
  - Normalize contracts, validate required shape, and calculate missing requirements.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-contract.service.spec.ts`
  - Prove contract matching does not use `families` or string-key strategy branches.

### CanonicalSpec / IR / AST Spine

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec.ts`
  - Add contract-normalized order program intent fields while preserving existing rules.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Project contract atoms into CanonicalSpecV2 order program intent.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`
  - Extend `OrderProgramDef`, `LevelSetDef`, quantity/pairing/cancel policies if missing.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
  - Compile contract-normalized order program intent to `levelSets + orderPrograms`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts`
  - Ensure AST order program payload can preserve all runtime fields.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`
  - Preserve `orderPrograms` and mark execution model as order-program capable.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts`
  - Add invariant checks for contract -> CanonicalSpecV2 -> IR -> AST.
- Tests:
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ast-compiler.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts`

### Trading Abstraction

- Modify: `apps/quantify/src/modules/trading/core/types.ts`
  - Add `OrderQueryInput` with symbol, client order id, and exchange order id filters for order state sync.
- Modify: `apps/quantify/src/modules/trading/core/interface.ts`
  - Ensure exchange clients expose open/closed order and cancel capabilities needed by grid runtime.
- Modify: `apps/quantify/src/modules/trading/trading.service.ts`
  - Add user/account-safe wrappers for order sync by symbol and client order id.
- Modify: `apps/quantify/src/modules/trading/exchanges/okx-client.ts`
  - Fill gaps for OKX limit GTC, client order id attribution, closed orders, posSide/reduceOnly/tdMode.
- Test:
  - `apps/quantify/src/modules/trading/trading.service.spec.ts`
  - `apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts`

### Grid Runtime

- Create: `apps/quantify/prisma/schema/grid_runtime.prisma`
  - Models: `GridRuntimeInstance`, `GridLevel`, `GridOrder`, `GridFill`, `GridRuntimeEvent`.
- Modify after schema changes:
  - Run `dx db format`
  - Run `dx db generate`
  - Create migration with `dx db migrate --dev --name add_grid_runtime`
- Create: `apps/quantify/src/modules/grid-runtime/grid-runtime.module.ts`
- Create: `apps/quantify/src/modules/grid-runtime/controllers/grid-runtime.controller.ts`
- Create: `apps/quantify/src/modules/grid-runtime/dto/grid-runtime.dto.ts`
- Create: `apps/quantify/src/modules/grid-runtime/repositories/grid-runtime.repository.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-order-planner.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-runtime-scheduler.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-runtime-state-machine.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/types/grid-runtime.types.ts`
- Tests:
  - `apps/quantify/src/modules/grid-runtime/services/grid-order-planner.service.spec.ts`
  - `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`
  - `apps/quantify/src/modules/grid-runtime/services/grid-runtime-state-machine.service.spec.ts`
  - `apps/quantify/src/modules/grid-runtime/repositories/grid-runtime.repository.spec.ts`

### Deploy and Runtime Routing

- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
  - On deploy, detect AST `orderPrograms` and create grid runtime instance instead of signal runtime subscription.
- Modify: `apps/quantify/src/modules/account-strategy-view/account-strategy-view.module.ts`
  - Inject `GridRuntimeModule` or `GridRuntimeService` into the deploy path.
- Test:
  - `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts`
  - `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy-safety.spec.ts`

---

## Task 1: Add Contract Types and Contract Normalizer

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-contract.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-contract.service.spec.ts`

- [ ] **Step 1: Write failing contract service tests**

Add tests covering:

```ts
import { SemanticAtomContractService } from '../semantic-atom-contract.service'

describe('SemanticAtomContractService', () => {
  const service = new SemanticAtomContractService()

  it('matches capabilities by structured domain verb object shape, not string key or families', () => {
    const contracts = [
      {
        id: 'trigger-1',
        kind: 'trigger',
        capabilities: [
          {
            domain: 'price',
            verb: 'define',
            object: 'level_set',
            shape: { lower: 60000, upper: 80000, gridCount: 100, spacingMode: 'arithmetic' },
          },
        ],
        requires: [],
        params: {},
      },
      {
        id: 'action-1',
        kind: 'action',
        capabilities: [
          {
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: { timeInForce: 'gtc', recycleOnFill: true },
          },
        ],
        requires: [
          { domain: 'price', verb: 'define', object: 'level_set' },
          { domain: 'capital', verb: 'allocate', object: 'per_order_budget' },
        ],
        params: {},
      },
      {
        id: 'position-1',
        kind: 'position',
        capabilities: [
          {
            domain: 'capital',
            verb: 'allocate',
            object: 'per_order_budget',
            shape: { value: 20, asset: 'USDT' },
          },
        ],
        requires: [],
        params: {},
      },
    ] as const

    const result = service.resolve(contracts)

    expect(result.missingRequirements).toEqual([])
    expect(result.capabilities.map(item => `${item.domain}:${item.verb}:${item.object}`)).toEqual([
      'price:define:level_set',
      'order_program:maintain:limit_ladder',
      'capital:allocate:per_order_budget',
    ])
  })

  it('reports missing requirements without downgrading order programs to signals', () => {
    const result = service.resolve([
      {
        id: 'action-1',
        kind: 'action',
        capabilities: [
          {
            domain: 'order_program',
            verb: 'maintain',
            object: 'limit_ladder',
            shape: { timeInForce: 'gtc', recycleOnFill: true },
          },
        ],
        requires: [
          { domain: 'price', verb: 'define', object: 'level_set' },
        ],
        params: {},
      },
    ])

    expect(result.missingRequirements).toEqual([
      { contractId: 'action-1', domain: 'price', verb: 'define', object: 'level_set' },
    ])
    expect(result.canCompileOrderProgram).toBe(false)
  })
})
```

- [ ] **Step 2: Run the failing tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-contract.service.spec.ts
```

Expected: FAIL because `semantic-atom-contract.service.ts` does not exist.

- [ ] **Step 3: Add contract types**

In `semantic-state.ts`, add:

```ts
export type SemanticContractKind = 'trigger' | 'action' | 'risk' | 'position' | 'context'
export type SemanticCapabilityDomain = 'market' | 'price' | 'order_program' | 'capital' | 'exposure' | 'margin' | 'guard'

export interface SemanticCapabilityShape {
  [key: string]: string | number | boolean | null | SemanticCapabilityShape | SemanticCapabilityShape[]
}

export interface SemanticCapability {
  domain: SemanticCapabilityDomain
  verb: string
  object: string
  shape: SemanticCapabilityShape
}

export interface SemanticRequirement {
  domain: SemanticCapabilityDomain
  verb: string
  object: string
}

export interface SemanticEffect {
  domain: SemanticCapabilityDomain
  verb: string
  object: string
  shape?: SemanticCapabilityShape
}

export interface SemanticAtomContract {
  id: string
  kind: SemanticContractKind
  capabilities: SemanticCapability[]
  requires: SemanticRequirement[]
  params: Record<string, unknown>
  effects?: SemanticEffect[]
}
```

Then add `contracts?: SemanticAtomContract[]` to `SemanticTriggerState`, `SemanticActionState`, `SemanticRiskState`, and `SemanticPositionState`.

- [ ] **Step 4: Add patch type support**

In `codegen-semantic-patch.ts`, import `SemanticAtomContract` and add optional `contracts?: SemanticAtomContract[]` to the patch node envelopes for triggers, actions, risk, and position.

- [ ] **Step 5: Implement the service**

Create `semantic-atom-contract.service.ts`:

```ts
import type { SemanticAtomContract, SemanticCapability, SemanticRequirement } from '../types/semantic-state'
import { Injectable } from '@nestjs/common'

export interface MissingSemanticRequirement extends SemanticRequirement {
  contractId: string
}

export interface SemanticAtomContractResolution {
  capabilities: SemanticCapability[]
  missingRequirements: MissingSemanticRequirement[]
  canCompileOrderProgram: boolean
}

@Injectable()
export class SemanticAtomContractService {
  resolve(contracts: readonly SemanticAtomContract[]): SemanticAtomContractResolution {
    const capabilities = contracts.flatMap(contract => contract.capabilities)
    const missingRequirements = contracts.flatMap(contract =>
      contract.requires
        .filter(requirement => !this.hasCapability(capabilities, requirement))
        .map(requirement => ({ contractId: contract.id, ...requirement })),
    )

    return {
      capabilities,
      missingRequirements,
      canCompileOrderProgram: missingRequirements.length === 0 && this.hasOrderProgramCapability(capabilities),
    }
  }

  private hasCapability(capabilities: readonly SemanticCapability[], requirement: SemanticRequirement): boolean {
    return capabilities.some(capability =>
      capability.domain === requirement.domain
      && capability.verb === requirement.verb
      && capability.object === requirement.object,
    )
  }

  private hasOrderProgramCapability(capabilities: readonly SemanticCapability[]): boolean {
    return capabilities.some(capability =>
      capability.domain === 'order_program'
      && capability.verb === 'maintain'
      && capability.object === 'limit_ladder',
    )
  }
}
```

- [ ] **Step 6: Run the focused tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-contract.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts apps/quantify/src/modules/llm-strategy-codegen/types/codegen-semantic-patch.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-contract.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-contract.service.spec.ts
git commit -F - <<'MSG'
feat: add semantic atom contracts

Refs: #942
MSG
```

---

## Task 2: Project Contract Atoms Into CanonicalSpecV2

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts`

- [ ] **Step 1: Add failing CanonicalSpec builder test**

Add a test that builds a SemanticState containing contract atoms for:

- market context: OKX BTC-USDT-SWAP perp 15m
- price level set: 60000-80000, 100 grids
- order program: limit ladder GTC recycle on fill
- capital: per-order 20 USDT
- exposure: neutral

Expected CanonicalSpecV2 includes an order program intent and does not create ordinary `OPEN_LONG` / `CLOSE_LONG` rule actions for the grid.

Use assertions:

```ts
expect(canonicalSpec.orderPrograms).toEqual([
  expect.objectContaining({
    kind: 'contract_order_program',
    mode: 'neutral',
    orderType: 'limit',
    timeInForce: 'gtc',
  }),
])
expect(canonicalSpec.rules.flatMap(rule => rule.actions.map(action => action.type))).not.toContain('OPEN_LONG')
expect(canonicalSpec.rules.flatMap(rule => rule.actions.map(action => action.type))).not.toContain('CLOSE_LONG')
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts -t "projects contract order programs"
```

Expected: FAIL because CanonicalSpecV2 has no `orderPrograms` projection.

- [ ] **Step 3: Add CanonicalSpec order program intent types**

Add to `canonical-strategy-spec.ts`:

```ts
export interface CanonicalOrderProgramIntent {
  id: string
  kind: 'contract_order_program'
  mode: 'spot' | 'perp_long' | 'perp_short' | 'perp_neutral'
  levelSet: {
    lower: number
    upper: number
    gridCount?: number
    spacingPct?: number
    spacingMode: 'arithmetic' | 'geometric'
  }
  budget: {
    mode: 'per_order_quote' | 'total_quote'
    value: number
    asset: string
  }
  orderType: 'limit'
  timeInForce: 'gtc'
  recycleOnFill: boolean
  cancelOnStop: boolean
}
```

Add `orderPrograms: CanonicalOrderProgramIntent[]` to `CanonicalStrategySpecV2`.

- [ ] **Step 4: Implement projection**

In `canonical-spec-builder.service.ts`, add a focused helper:

```ts
private buildContractOrderPrograms(state: SemanticState): CanonicalOrderProgramIntent[] {
  const contracts = this.collectContracts(state)
  const resolution = this.contracts.resolve(contracts)
  if (!resolution.canCompileOrderProgram) return []
  return [this.toCanonicalOrderProgramIntent(resolution.capabilities, state)]
}
```

Do not inspect `state.families`. Do not switch on legacy atom string keys to decide that this is a grid.

- [ ] **Step 5: Run the focused test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts -t "projects contract order programs"
```

Expected: PASS.

- [ ] **Step 6: Run nearby CanonicalSpec tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
git commit -F - <<'MSG'
feat: project contract order programs into canonical spec

Refs: #942
MSG
```

---

## Task 3: Compile Canonical Order Programs to IR and AST

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`
- Tests:
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts`
  - `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ast-compiler.service.spec.ts`

- [ ] **Step 1: Write failing IR compiler tests**

Add tests asserting:

```ts
expect(ir.signalCatalog.levelSets).toEqual([
  expect.objectContaining({
    kind: 'ARITHMETIC_LEVEL_SET',
    hardBounds: expect.any(Object),
  }),
])
expect(ir.orderPrograms).toEqual([
  expect.objectContaining({
    kind: 'LIMIT_LADDER',
    orderType: 'limit',
    recycleOnFill: true,
  }),
])
expect(ir.executionPolicy.orderTypeDefault).toBe('limit')
expect(ir.executionPolicy.timeInForce).toBe('gtc')
expect(ir.portfolio.maxConcurrentPositions).toBeGreaterThan(1)
expect(ir.portfolio.allowPyramiding).toBe(true)
```

- [ ] **Step 2: Write failing AST compiler tests**

Add tests asserting:

```ts
expect(ast.orderPrograms).toHaveLength(1)
expect(ast.orderPrograms[0].payload).toEqual(expect.objectContaining({
  kind: 'LIMIT_LADDER',
  recycleOnFill: true,
}))
expect(ast.decisionPrograms.flatMap(program => program.actions)).toEqual([])
```

- [ ] **Step 3: Run failing tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts -t "contract order program"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ast-compiler.service.spec.ts -t "preserves order programs"
```

Expected: FAIL.

- [ ] **Step 4: Extend IR types**

In `canonical-strategy-ir.ts`, ensure order program can carry:

```ts
export interface OrderProgramDef {
  id: string
  kind: 'LIMIT_LADDER'
  activeWhen?: string
  sidePolicy: 'spot_grid' | 'perp_long' | 'perp_short' | 'perp_neutral'
  levelSetRef: string
  quantity: QuantityDef
  orderType: 'limit'
  timeInForce: 'gtc'
  recycleOnFill: boolean
  pairingPolicy: 'adjacent_level'
  cancelScope: 'program_orders'
}
```

Preserve current `OrderProgramDef` fields that are already consumed by `CanonicalStrategyAstCompilerService`, and add the new fields without renaming existing public fields.

- [ ] **Step 5: Implement IR compilation**

In `canonical-spec-v2-ir-compiler.service.ts`, map each `CanonicalOrderProgramIntent` into:

- constants for lower/upper
- one `LevelSetDef`
- predicates for active range
- one `OrderProgramDef`

Set portfolio and execution policy for order programs:

```ts
portfolio: {
  positionMode,
  sizing,
  maxConcurrentPositions: levelCount,
  allowPyramiding: true,
  maxPyramidingLayers: levelCount,
}
executionPolicy: {
  signalEvaluation: 'bar_close',
  fillPolicy: 'exchange_order_update',
  timeframeAlignment: 'strict',
  orderTypeDefault: 'limit',
  timeInForce: 'gtc',
  allowPartialFill: true,
}
```

- [ ] **Step 6: Preserve AST order programs**

In `canonical-strategy-ast-compiler.service.ts`, keep `compileOrderPrograms()` as the only projection for IR `orderPrograms`; do not expand them into `decisionPrograms`.

- [ ] **Step 7: Run focused tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts -t "contract order program"
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ast-compiler.service.spec.ts -t "preserves order programs"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ast-compiler.service.spec.ts
git commit -F - <<'MSG'
feat: compile contract order programs to IR and AST

Refs: #942
MSG
```

---

## Task 4: Add Contract Invariant Checks

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts`

- [ ] **Step 1: Write failing invariant tests**

Add tests:

1. Passing case: contract atoms compile to CanonicalSpec order program, IR order program, AST order program.
2. Failing case: AST loses `orderPrograms`.
3. Failing case: IR replaces order program with ordinary `OPEN_LONG`.

Expected failure marker:

```ts
expect(checks.some(check =>
  check.status === 'fail' && check.code === 'contract_order_program_missing',
)).toBe(true)
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts -t "contract order program"
```

Expected: FAIL.

- [ ] **Step 3: Implement invariant**

Add helper methods:

```ts
private expectedOrderProgramContracts(semanticState: SemanticState): ExpectedOrderProgramContract[] {
  const contracts = this.collectContracts(semanticState)
  const resolution = this.contracts.resolve(contracts)
  return resolution.canCompileOrderProgram ? [this.toExpectedOrderProgramContract(resolution)] : []
}
```

Check:

- CanonicalSpec has matching order program intent.
- IR has matching `orderPrograms`.
- AST has matching `orderPrograms`.
- AST decision programs do not contain fallback `BUY / SELL / CLOSE_*` actions for the same contract.

- [ ] **Step 4: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts -t "contract order program"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-invariant.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts
git commit -F - <<'MSG'
feat: enforce contract order program invariants

Refs: #942
MSG
```

---

## Task 5: Add Grid Runtime Prisma Models

**Files:**
- Create: `apps/quantify/prisma/schema/grid_runtime.prisma`
- Modify generated Prisma artifacts via dx commands only.

- [ ] **Step 1: Add schema**

Create models:

```prisma
enum GridRuntimeStatus {
  CREATED
  INITIALIZING
  RUNNING
  PAUSING
  PAUSED
  STOPPING
  STOPPED
  RECONCILE_REQUIRED
  ERROR
  TERMINATED
}

enum GridOrderStatus {
  PLANNED
  SUBMITTING
  OPEN
  PARTIALLY_FILLED
  FILLED
  CANCELING
  CANCELED
  REJECTED
  STALE
}

model GridRuntimeInstance {
  id                  String            @id @default(cuid())
  strategyInstanceId  String            @map("strategy_instance_id")
  publishedSnapshotId String            @map("published_snapshot_id")
  userId              String            @map("user_id")
  exchangeAccountId   String            @map("exchange_account_id")
  exchangeId          String            @map("exchange_id")
  marketType          String            @map("market_type")
  symbol              String
  mode                String
  status              GridRuntimeStatus @default(CREATED)
  configSnapshot      Json              @map("config_snapshot")
  stopReason          String?           @map("stop_reason")
  lastSyncAt          DateTime?         @map("last_sync_at")
  createdAt           DateTime          @default(now()) @map("created_at")
  updatedAt           DateTime          @default(now()) @updatedAt @map("updated_at")

  levels GridLevel[]
  orders GridOrder[]
  fills  GridFill[]
  events GridRuntimeEvent[]

  @@index([userId, createdAt], map: "idx_grid_runtime_user_created")
  @@index([strategyInstanceId], map: "idx_grid_runtime_strategy_instance")
  @@map("grid_runtime_instances")
}
```

Add `GridLevel`, `GridOrder`, `GridFill`, and `GridRuntimeEvent` with indexes for instance id, client order id, exchange order id, fill id, and created time.

- [ ] **Step 2: Format and generate**

Run:

```bash
dx db format
dx db generate
```

Expected: both commands succeed.

- [ ] **Step 3: Create migration**

Run:

```bash
dx db migrate --dev --name add_grid_runtime
```

Expected: migration file created under `apps/quantify/prisma/schema/migrations`.

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/prisma/schema/grid_runtime.prisma apps/quantify/prisma/schema/migrations
git commit -F - <<'MSG'
feat: add grid runtime persistence models

Refs: #942
MSG
```

---

## Task 6: Implement Grid Runtime Repository and Planner

**Files:**
- Create: `apps/quantify/src/modules/grid-runtime/types/grid-runtime.types.ts`
- Create: `apps/quantify/src/modules/grid-runtime/repositories/grid-runtime.repository.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-order-planner.service.ts`
- Tests:
  - `apps/quantify/src/modules/grid-runtime/repositories/grid-runtime.repository.spec.ts`
  - `apps/quantify/src/modules/grid-runtime/services/grid-order-planner.service.spec.ts`

- [ ] **Step 1: Write planner tests**

Cover:

- spot initial orders below current price are buys.
- perp long below current price opens long, above current price closes long.
- perp short above current price opens short, below current price closes short.
- perp neutral creates both long and short ladders where exposure policy permits.

Expected shape:

```ts
expect(plan.orders).toContainEqual(expect.objectContaining({
  side: 'buy',
  orderType: 'limit',
  timeInForce: 'gtc',
  levelIndex: 42,
}))
```

- [ ] **Step 2: Implement planner types**

Define:

```ts
export type GridRuntimeMode = 'spot' | 'perp_long' | 'perp_short' | 'perp_neutral'
export interface GridRuntimeConfigSnapshot {
  mode: GridRuntimeMode
  lowerPrice: string
  upperPrice: string
  gridCount: number
  perOrderQuote: string
  quoteAsset: string
  baseAsset: string
  orderType: 'limit'
  timeInForce: 'gtc'
}
```

- [ ] **Step 3: Implement repository methods**

Repository methods:

- `createInstanceWithLevels(input)`
- `findInstanceForUser(input)`
- `listOrders(instanceId)`
- `createPlannedOrder(input)`
- `markOrderSubmitting(input)`
- `markOrderOpen(input)`
- `recordFillOnce(input)`
- `appendEvent(input)`

Use Prisma through the repository layer only.

- [ ] **Step 4: Implement planner**

Planner builds deterministic levels and planned orders from AST-derived config and current price. Use Decimal-compatible strings at boundaries; avoid floating-point accumulation by deriving each level from lower/upper/index.

- [ ] **Step 5: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-order-planner.service.spec.ts
dx test unit quantify apps/quantify/src/modules/grid-runtime/repositories/grid-runtime.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/grid-runtime
git commit -F - <<'MSG'
feat: add grid runtime repository and planner

Refs: #942
MSG
```

---

## Task 7: Extend TradingService and OKX Client for Grid Order Sync

**Files:**
- Modify: `apps/quantify/src/modules/trading/core/types.ts`
- Modify: `apps/quantify/src/modules/trading/core/interface.ts`
- Modify: `apps/quantify/src/modules/trading/trading.service.ts`
- Modify: `apps/quantify/src/modules/trading/exchanges/okx-client.ts`
- Tests:
  - `apps/quantify/src/modules/trading/trading.service.spec.ts`
  - `apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts`

- [ ] **Step 1: Write tests for client order id and closed order sync**

Add OKX tests asserting:

- create order sends `clOrdId`.
- fetch open orders maps `clOrdId`.
- fetch closed orders maps filled amount, status, side, price, raw.
- perp order params preserve `tdMode`, `posSide`, and `reduceOnly`.

- [ ] **Step 2: Add trading service wrappers**

Add methods:

```ts
async getClosedOrders(userId, exchangeId, marketType, symbol?, exchangeAccountId?)
async getOrderByClientOrderId(userId, exchangeId, marketType, clientOrderId, symbol, exchangeAccountId?)
```

If OKX has no direct client-order-id fetch in the current abstraction, implement by searching open and recent closed orders for the symbol.

- [ ] **Step 3: Implement OKX gaps**

In `okx-client.ts`, ensure:

- limit orders use OKX `ordType: 'limit'`.
- GTC maps to OKX default limit behavior.
- `clientOrderId` maps to `clOrdId`.
- closed orders parse OKX order history.
- perp extra params include `tdMode`, `posSide`, and `reduceOnly` when provided.

- [ ] **Step 4: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts
dx test unit quantify apps/quantify/src/modules/trading/trading.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/trading/core/types.ts apps/quantify/src/modules/trading/core/interface.ts apps/quantify/src/modules/trading/trading.service.ts apps/quantify/src/modules/trading/exchanges/okx-client.ts apps/quantify/src/modules/trading/trading.service.spec.ts apps/quantify/src/modules/trading/exchanges/okx-client.spec.ts
git commit -F - <<'MSG'
feat: support grid order sync through trading service

Refs: #942
MSG
```

---

## Task 8: Implement Grid Runtime State Machine and Sync

**Files:**
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-runtime-state-machine.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-runtime.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/services/grid-runtime-scheduler.service.ts`
- Create: `apps/quantify/src/modules/grid-runtime/grid-runtime.module.ts`
- Tests:
  - `apps/quantify/src/modules/grid-runtime/services/grid-runtime-state-machine.service.spec.ts`
  - `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`

- [ ] **Step 1: Write state machine tests**

Cover:

- `CREATED -> INITIALIZING -> RUNNING`
- fill creates paired inverse planned order.
- duplicate fill sync does not create another fill.
- boundary break moves to `STOPPING` and cancels only own open orders.
- exchange mismatch moves to `RECONCILE_REQUIRED`.

- [ ] **Step 2: Implement state transitions**

Implement explicit transition methods:

```ts
initialize(instanceId)
markRunning(instanceId)
pause(instanceId)
resume(instanceId)
stop(instanceId, reason)
markReconcileRequired(instanceId, reason)
markError(instanceId, reason)
```

Each method writes a `GridRuntimeEvent`.

- [ ] **Step 3: Implement sync**

`GridOrderSyncService.syncInstance(instanceId)`:

1. Load instance, orders, and config.
2. Fetch OKX open and closed orders through `TradingService`.
3. Match by `clientOrderId`.
4. Update order statuses.
5. Record fills idempotently.
6. Ask state machine to create inverse planned orders for newly completed levels.

- [ ] **Step 4: Implement scheduler**

Use Nest scheduler pattern already used in `strategy-signals` and `positions`. Register a cron that syncs active grid instances in small batches.

- [ ] **Step 5: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-runtime-state-machine.service.spec.ts
dx test unit quantify apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/grid-runtime
git commit -F - <<'MSG'
feat: implement grid runtime state machine

Refs: #942
MSG
```

---

## Task 9: Add Deploy Routing and Grid Runtime API

**Files:**
- Create: `apps/quantify/src/modules/grid-runtime/controllers/grid-runtime.controller.ts`
- Create: `apps/quantify/src/modules/grid-runtime/dto/grid-runtime.dto.ts`
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
- Modify module imports where Quantify root module wires feature modules.
- Tests:
  - `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts`
  - `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy-safety.spec.ts`

- [ ] **Step 1: Write deploy routing tests**

Add tests:

```ts
it('routes published snapshots with AST order programs to grid runtime', async () => {
  // arrange published snapshot with ast.orderPrograms length 1
  // act deploy
  // assert gridRuntimeService.createFromPublishedSnapshot called
  // assert signal subscription/runtime path not called
})
```

Add a regression test that a snapshot without `orderPrograms` still uses existing signal runtime.

- [ ] **Step 2: Implement deploy routing**

In account strategy deploy service, add a single boundary helper:

```ts
private hasOrderPrograms(snapshot: PublishedStrategySnapshot): boolean {
  const ast = this.readSnapshotAst(snapshot)
  return Array.isArray(ast?.orderPrograms) && ast.orderPrograms.length > 0
}
```

If true, call `GridRuntimeService.createFromPublishedSnapshot(...)`.

- [ ] **Step 3: Implement API**

Controller endpoints:

```text
GET  /grid-runtime/instances/:id
GET  /grid-runtime/instances/:id/orders
GET  /grid-runtime/instances/:id/fills
POST /grid-runtime/instances/:id/pause
POST /grid-runtime/instances/:id/resume
POST /grid-runtime/instances/:id/stop
POST /grid-runtime/instances/:id/reconcile
```

Use current authenticated user. Repository queries must include `userId`.

- [ ] **Step 4: Run tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts -t "grid runtime"
dx test unit quantify apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy-safety.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/grid-runtime apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy-safety.spec.ts
git commit -F - <<'MSG'
feat: route order program deployments to grid runtime

Refs: #942
MSG
```

---

## Task 10: End-to-End Verification and Contracts Build

**Files:**
- Modify generated API contracts only if new controller endpoints affect OpenAPI output.
- Add E2E tests under `apps/quantify/e2e/grid-runtime`.

- [ ] **Step 1: Run focused unit suites**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-contract.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-v2-ir-compiler.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-strategy-ast-compiler.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-invariant.service.spec.ts
dx test unit quantify apps/quantify/src/modules/grid-runtime
dx test unit quantify apps/quantify/src/modules/trading
```

Expected: PASS.

- [ ] **Step 2: Run Quantify build**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 3: Build API contracts if controller OpenAPI changed**

Run:

```bash
dx build contracts --dev
```

Expected: PASS and generated contract changes are reviewed.

- [ ] **Step 4: Run affected E2E**

Add `apps/quantify/e2e/grid-runtime/grid-runtime-deploy.e2e-spec.ts` covering deploy routing with mocked OKX responses, then run:

```bash
dx test e2e quantify apps/quantify/e2e/grid-runtime
```

Expected: PASS.

- [ ] **Step 5: Final commit**

```bash
git add apps/quantify packages/api-contracts docs/superpowers/plans/2026-04-29-ai-quant-contract-grid-runtime.md
git commit -F - <<'MSG'
test: verify contract grid runtime flow

Refs: #942
MSG
```

---

## Self-Review Notes

- Spec coverage:
  - No families/key strategy authority: Tasks 1, 2, 4.
  - SemanticState -> CanonicalSpecV2 -> IR -> AST orderPrograms: Tasks 1 through 4.
  - OKX demo spot/perp long/perp short/perp neutral runtime: Tasks 6 through 8.
  - Deploy routing away from SignalExecutor: Task 9.
  - Status API only, no full UI: Task 9.
  - Verification: Task 10.
- Placeholder scan:
  - This plan intentionally includes exact file paths, target commands, expected results, and concrete test assertions.
- Type consistency:
  - Contract type names are defined in Task 1 and reused consistently in later tasks.
  - `orderPrograms` is the canonical field name from CanonicalSpecV2 through IR and AST.
