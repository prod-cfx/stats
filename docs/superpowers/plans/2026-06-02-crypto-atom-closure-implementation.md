# Crypto Atom Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close AI Quant crypto P1/P2/P3 atom backlog from natural-language entry through rules, readiness, canonical, IR/runtime/backtest, and deploy evidence while preserving fail-closed behavior.

**Architecture:** Implement atom-first vertical slices. Each slice starts with coverage or focused regression tests, then wires dispatcher/contract/readiness/canonical/IR/deploy layers only as needed for that atom. Coverage reporter remains the acceptance oracle and must never mark an atom `supported_executable` unless full evidence exists.

**Tech Stack:** TypeScript, NestJS services, Jest unit tests via `dx`, existing llm-strategy-codegen rules mainflow, canonical spec v2, IR compiler, compiled script/deploy envelope services.

---

## File Map

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts` - top-level coverage regression tests for each closure wave.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/crypto-coverage-runner.ts` - only if layer attribution needs more precise evidence; no support shortcuts.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/crypto-coverage-taxonomy.ts` - atom weights/phase labels if new atom keys become report-critical.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts` - canonical atom contract entries and display/readiness metadata.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/utterance-corpus.types.ts` - add atom keys when corpus type union blocks new utterances.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts` - natural-language extraction into typed `rules[]` leaves.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts` - preserve new params only when generic builder drops them.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts` - slot/readiness validation for new atom params.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts` - canonical condition/action/risk/program/scope emission.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts` - IR emission for new canonical shapes.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-execution-envelope.service.ts` - deploy/order payload evidence if current envelope drops order options or risk gates.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/stage4-real-strategy-corpus.ts` - only when new clarification turns are required to keep entry-first tests deterministic.

## Task 1: P1 Coverage Guardrails

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts`

- [ ] **Step 1: Add failing P1 closure test**

Add this test below the existing P1 B-scope test:

```ts
  it('closes P1 B-scope fail-closed atoms through executable evidence', async () => {
    const targetIds = [
      'crypto-b-orderbook-spread-post-only',
      'crypto-b-portfolio-daily-loss-kill-switch',
      'crypto-b-limit-chase-reduce-only',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    const failures = results.flatMap(result => result.caseEvidence.failures)
    expect(failures).toEqual([])
  })
```

- [ ] **Step 2: Run test and verify RED**

Run: `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts -t "closes P1"`

Expected: FAIL with current missing contract/deploy payload failures for P1 atoms.

- [ ] **Step 3: Keep the test as the acceptance target**

Do not weaken this test. P1 closure finishes only when this test passes without filtering failures.

## Task 2: P1 Atom Contracts And NL Extraction

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/nl-gateway/utterance-corpus/utterance-corpus.types.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`

- [ ] **Step 1: Register P1 atom keys**

Add registry metadata for:

```ts
'orderbook.spread_condition'
'orderbook.depth_ratio'
'execution.post_only'
'execution.reduce_only'
'execution.limit_chase'
'risk.daily_loss_limit'
'risk.kill_switch'
'position.max_concurrent_positions'
```

Use existing entries as templates:

- orderbook predicates mirror `orderbook.imbalance` bucket/roles/temporality and classifier support status.
- execution options are structural effect atoms with required booleans or bounded counts.
- risk/position gates are structural effects with finite numeric params.

- [ ] **Step 2: Add dispatcher extraction**

In `collectTypedRuleGlobalEffects`, ensure phrases emit these exact params:

```ts
// spread < 0.03%
{ key: 'orderbook.spread_condition', phase: 'entry', params: { operator: 'lt', valuePct: 0.03 } }

// depth ratio > 2
{ key: 'orderbook.depth_ratio', phase: 'entry', params: { side: 'bid_over_ask', operator: 'gt', ratio: 2 } }

// post-only
{ key: 'execution.post_only', phase: 'entry', params: { postOnly: true } }

// reduce-only
{ key: 'execution.reduce_only', phase: 'exit', params: { reduceOnly: true } }

// chase once after 3 bars
{ key: 'execution.limit_chase', phase: 'exit', params: { maxChases: 1, timeoutBars: 3 } }

// daily loss > 5%
{ key: 'risk.daily_loss_limit', phase: 'gate', params: { valuePct: 5 } }

// kill switch blocks entries
{ key: 'risk.kill_switch', phase: 'gate', params: { action: 'block_new_entries' } }

// max 3 positions
{ key: 'position.max_concurrent_positions', phase: 'gate', params: { count: 3 } }
```

- [ ] **Step 3: Run P1 test and verify progress**

Run: `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts -t "closes P1"`

Expected: no `missing_atom_contract`; remaining failures should move to canonical/IR/deploy layers.

## Task 3: P1 Canonical, IR, And Deploy Payload

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-execution-envelope.service.ts`
- Test: targeted existing compiler/envelope specs nearest changed methods.

- [ ] **Step 1: Canonicalize orderbook predicates**

Map `orderbook.spread_condition` and `orderbook.depth_ratio` into canonical conditions using the same condition node family used by existing orderbook predicates. If no family exists, add a generic atomic predicate condition that preserves `atomKey` and params for IR.

- [ ] **Step 2: Canonicalize execution options**

Attach `execution.post_only`, `execution.reduce_only`, and `execution.limit_chase` as order metadata on the matching open/close/limit/reduce action for the same rule. Do not create standalone trade actions for option atoms.

- [ ] **Step 3: Canonicalize portfolio gates**

Emit gate/risk rules for `risk.daily_loss_limit`, `risk.kill_switch`, and `position.max_concurrent_positions` that produce `BLOCK_NEW_ENTRY` or pause strategy actions. Keep them separate from stop-loss exits.

- [ ] **Step 4: Emit IR and deploy evidence**

Extend IR compiler/envelope only for the canonical fields introduced above. Preserve exact params:

```ts
postOnly: true
reduceOnly: true
limitChase: { maxChases: 1, timeoutBars: 3 }
portfolioRisk: { dailyLossLimitPct: 5, maxConcurrentPositions: 3, action: 'block_new_entries' }
```

- [ ] **Step 5: Run P1 acceptance**

Run: `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts -t "closes P1"`

Expected: PASS.

- [ ] **Step 6: Commit P1 closure**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
feat: close P1 crypto execution atoms

变更说明：
- 打通 orderbook、execution option、portfolio risk gate P1 atom 主链路
- 保持 unsupported C-scope 和缺失 substrate fail-closed

Refs: #2145
MSG
```

## Task 4: P2 Front-Half Guardrail

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts`

- [ ] **Step 1: Add failing P2 test**

```ts
  it('closes P2 structural atoms through canonical and IR layers', async () => {
    const targetIds = [
      'stage4-reduce-limit-conditional-order',
      'stage4-program-rebalance',
      'stage4-multi-leg-pair-spread',
      'stage4-time-cooldown-window',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    const failures = results.flatMap(result => result.caseEvidence.failures)
    expect(failures.filter(item => item.kind === 'missing_atom_contract')).toEqual([])
    expect(failures.filter(item => item.kind === 'missing_canonical_emit')).toEqual([])
    expect(failures.filter(item => item.kind === 'missing_ir_emit')).toEqual([])
  })
```

- [ ] **Step 2: Run test and verify RED**

Run: `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts -t "closes P2"`

Expected: FAIL on `action.reduce_position`, `action.conditional_order`, `program.rebalance`, `scope.leg`, and `time.cooldown_window` current blockers.

## Task 5: P2 Structural Atom Implementation

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/atom-contracts/atom-contract-registry.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/generic-seed-dispatcher.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-state-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`

- [ ] **Step 1: Register reduce and conditional order**

Register `action.reduce_position` and `action.conditional_order`. Required slots:

```ts
action.reduce_position: { reducePct: number > 0 && <= 100 }
action.conditional_order: { triggerConditionRef: string, orderType: 'stop' | 'take_profit' | 'conditional' }
```

- [ ] **Step 2: Fix `scope.leg` shape**

Change generic leg extraction so it emits separate atoms, not one aggregate `legs[]` atom:

```ts
{ key: 'scope.symbol', params: { symbolScopeKind: 'symbol', scopeId: 'symbol_btcusdt', symbols: ['BTCUSDT'], primarySymbol: 'BTCUSDT' } }
{ key: 'scope.symbol', params: { symbolScopeKind: 'symbol', scopeId: 'symbol_ethusdt', symbols: ['ETHUSDT'], primarySymbol: 'ETHUSDT' } }
{ key: 'scope.leg', params: { legScopeKind: 'leg', legId: 'btc_long', direction: 'long', instrumentRef: 'symbol_btcusdt' } }
{ key: 'scope.leg', params: { legScopeKind: 'leg', legId: 'eth_short', direction: 'short', instrumentRef: 'symbol_ethusdt' } }
```

- [ ] **Step 3: Fix cooldown canonicalization**

Ensure `time.cooldown_window` becomes a gate/cooldown condition or risk cooldown rule and does not make `scope.timeframe` invalid. Single timeframe mention must not emit invalid required timeframe list containing only the primary timeframe.

- [ ] **Step 4: Add rebalance IR support**

Map canonical `program.rebalance` to an IR order-program node with program kind `rebalance` and preserved schedule/weights params.

- [ ] **Step 5: Run P2 acceptance**

Run: `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts -t "closes P2"`

Expected: PASS.

- [ ] **Step 6: Commit P2 closure**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
feat: close P2 crypto structural atoms

变更说明：
- 打通 reduce/conditional/rebalance/scope.leg/cooldown front-half 和 IR 层
- 保持多腿缺 binding、条件单缺 trigger 等场景 fail-closed

Refs: #2145
MSG
```

## Task 6: P3 Deploy Payload Guardrail

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts`

- [ ] **Step 1: Add failing P3 test**

```ts
  it('closes P3 deploy payload evidence for represented atoms', async () => {
    const targetIds = [
      'stage4-dca-schedule-budget',
      'stage4-dca-schedule-fixed-ratio',
      'stage4-boundary-atr-fixed-notional-leverage',
      'crypto-b-limit-chase-reduce-only',
    ]
    const results = await Promise.all(targetIds.map(async (id) => {
      const caseItem = CRYPTO_STRATEGY_COVERAGE_CORPUS.find(item => item.id === id)
      expect(caseItem).toBeDefined()
      return runCryptoCoverageCase(caseItem!)
    }))

    const failures = results.flatMap(result => result.caseEvidence.failures)
    expect(failures.filter(item => item.kind === 'missing_deploy_payload')).toEqual([])
  })
```

- [ ] **Step 2: Run test and verify RED**

Run: `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts -t "closes P3"`

Expected: FAIL on deploy payload evidence for DCA, boundary/ATR/fixed-notional/leverage, and limit-order related cases.

## Task 7: P3 Runtime And Deploy Evidence

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-v2-ir-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-execution-envelope.service.ts`
- Modify: targeted runtime/envelope tests near changed code.

- [ ] **Step 1: Close DCA deploy evidence**

Ensure `position.dca_schedule`, `position.budget_cap`, and fixed ratio sizing survive canonical -> IR -> deploy envelope as order-program or position-schedule payload.

- [ ] **Step 2: Close boundary/ATR/fixed-notional leverage evidence**

Either implement the supported boundary indicator route in canonical/IR or mark unsupported boundary variants with a precise blocked reason. For supported route, carry:

```ts
price.detect.indicator_boundary
position.fixed_notional
position.leverage
risk.atr_stop
action.open_long
```

through deploy payload evidence.

- [ ] **Step 3: Close limit order deploy evidence**

Carry `action.limit_order` and order options into deploy envelope only when `limitPrice` exists. Keep price-less limit order blocked.

- [ ] **Step 4: Run P3 acceptance**

Run: `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage/__tests__/crypto-coverage-reporter.spec.ts -t "closes P3"`

Expected: PASS, or failures converted to explicit unsupported/blocking reason when behavior is genuinely not implementable.

- [ ] **Step 5: Commit P3 closure**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen
git commit -F - <<'MSG'
feat: close P3 crypto deploy evidence

变更说明：
- 打通 DCA、boundary/ATR/fixed-notional/leverage、limit-order deploy/runtime evidence
- 保留 price-less limit order 和 unsupported boundary variant fail-closed

Refs: #2145
MSG
```

## Task 8: Final Report And Verification

**Files:**
- No generated report files committed.
- Create only transient `/tmp/crypto-closure-pr-comment.md` for PR comment body.

- [ ] **Step 1: Rerun full crypto report**

Run: `pnpm --filter @net/quantify exec tsx src/modules/llm-strategy-codegen/scripts/crypto-coverage-report.ts`

Expected: JSON report generated under `apps/quantify/tmp/crypto-strategy-coverage-report.json`.

- [ ] **Step 2: Inspect summary**

Run:

```bash
node - <<'NODE'
const r=require('./apps/quantify/tmp/crypto-strategy-coverage-report.json');
console.log(JSON.stringify(r.summary,null,2));
console.log(JSON.stringify(r.backlog,null,2));
NODE
```

Expected: pass cases and weighted B coverage improve; C unsupported count remains 4.

- [ ] **Step 3: Run verification suite**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts
dx build quantify --dev
```

Expected: all commands exit 0.

- [ ] **Step 4: Remove generated tmp reports**

Run:

```bash
rm -f apps/quantify/tmp/crypto-strategy-coverage-report.json apps/quantify/tmp/crypto-strategy-coverage-report.md
```

Expected: `git status --short` contains no `apps/quantify/tmp` files.

- [ ] **Step 5: Push and update PR**

Run:

```bash
git push
node - <<'NODE' >/tmp/crypto-closure-pr-comment.md
const r=require('./apps/quantify/tmp/crypto-strategy-coverage-report.json');
console.log('P1/P2/P3 crypto atom closure update:');
console.log('');
console.log('- Coverage summary:');
console.log('```json');
console.log(JSON.stringify(r.summary,null,2));
console.log('```');
console.log('- Remaining backlog:');
console.log('```json');
console.log(JSON.stringify(r.backlog,null,2));
console.log('```');
console.log('- Verification:');
console.log('  - dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage');
console.log('  - dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts');
console.log('  - dx build quantify --dev');
NODE
gh pr comment 2146 --body-file /tmp/crypto-closure-pr-comment.md
```

Expected: push succeeds and PR contains final closure summary.

## Self-Review

- Spec coverage: P1, P2, P3, fail-closed, entry-first, report, and verification requirements are mapped to tasks.
- Placeholder scan: no `TBD` or `TODO` placeholders; final PR comment is generated from the report JSON.
- Type consistency: atom keys match current report backlog and existing registry naming.
