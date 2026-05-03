# AI Quant LLM Perp tdMode Publication Design

## Context

After deploying latest `main` to staging, AI Quant one-click deployment can fail with `account_strategy.invalid_snapshot_execution_config` for LLM-generated perpetual strategies. The observed staging failure used `publishedSnapshotId=cmopipsuw05l4ilqs39gggz28`; its `deployment_execution_defaults` had `leverage`, `orderType`, `priceSource`, and `timeInForce`, but no `tdMode`, and `deployment_execution_constraints` had no `supportedTdModes`.

This now fails because deployment validation requires perpetual snapshots to explicitly carry a supported trade mode before runtime activation. OKX perpetual orders require an explicit trade mode: `cross` or `isolated`. The current product decision is to deploy AI Quant perpetual strategies as cross margin.

Official Strategy Plaza direct run already has its own runtime contract and includes `tdMode: "cross"` for perpetual templates. This design does not modify that direct official-template path.

## Scope

In scope:

- Fix ordinary LLM publication so new perpetual published snapshots include `tdMode: "cross"`.
- Cover all ordinary LLM publication entry points, including blank AI Quant chat, Strategy Plaza "edit" sessions, and account-detail edit recovery sessions.
- Add a dry-run/apply backfill for existing ordinary LLM perpetual snapshots that lack `tdMode`.
- Keep spot snapshots without `tdMode` and without `supportedTdModes`.

Out of scope:

- Changing Strategy Plaza official source snapshots or official copied snapshots.
- Adding isolated-margin selection.
- Relaxing deploy validation to silently default missing `tdMode`.
- Changing leverage, order type, time in force, price source, or account capability logic.

## Design

### Publication Contract

`CompiledPublicationGateService` remains the source that turns canonical IR into published snapshot runtime truth. Its deployment execution builders should encode the product contract directly:

- If `input.ir.market.instrumentType === "perpetual"`:
  - `deploymentExecutionDefaults.tdMode = "cross"`
  - `deploymentExecutionConstraints.supportedTdModes = ["cross"]`
- Otherwise, do not include either field.

The rest of the deployment execution config stays unchanged:

- `leverage` remains `1` for LLM snapshots.
- `priceSource` still follows `resolvePriceSource(input.ir.market.priceFeed)`.
- `orderType` still follows `input.ir.executionPolicy.orderTypeDefault`.
- `timeInForce` still follows `input.ir.executionPolicy.timeInForce`.

This keeps published snapshots as the complete deploy/runtime truth. Deploy should read the explicit snapshot contract, not infer trade mode later.

### Strategy Plaza Edit Path

Strategy Plaza direct run and Strategy Plaza edit are different flows:

- Direct run uses `StrategyPlazaRunService` and `StrategyPlazaOfficialSnapshotRepository`; it already uses official template runtime config.
- Edit session uses `StrategyPlazaEditSessionService`, which starts a normal `CodegenConversationService` session from the template edit seed.

Because edit sessions publish through the ordinary LLM publication pipeline, fixing `CompiledPublicationGateService` also fixes edited official-template strategies without touching the official-template direct-run code.

### Backfill

Add a dedicated LLM snapshot tdMode backfill script, separate from the existing official template tdMode backfill. It should default to dry-run and require `--apply` to write.

The script should select only snapshots matching all of these conditions:

- `strategyConfig.marketType = "perp"`
- `deploymentExecutionDefaults` exists and lacks `tdMode`
- `deploymentExecutionConstraints` exists and lacks `supportedTdModes`
- snapshot is not from `executionEnvelope.source = "strategy-plaza-official-template"`
- snapshot is not an official source/copy snapshot

The script should skip:

- spot snapshots
- official Strategy Plaza snapshots
- snapshots with valid `tdMode`
- snapshots missing either deployment execution object, because those need republish rather than targeted tdMode repair

On apply, the script should write:

- `deploymentExecutionDefaults.tdMode = "cross"`
- `deploymentExecutionConstraints.supportedTdModes = ["cross"]`

If the snapshot has a bound strategy instance, the script should also synchronize the bound runtime config:

- `strategyInstance.deploymentExecutionConfig.tdMode = "cross"` when missing
- `strategyInstance.params.deploymentExecutionConfig.tdMode = "cross"` when missing
- active subscription `customParams.deploymentExecutionConfig.tdMode = "cross"` when missing

The script should log every planned and applied repair with snapshot id, strategy instance id, and repaired fields.

## Error Handling

Deploy validation should stay strict. A perpetual snapshot without `tdMode` should continue to fail with `account_strategy.invalid_snapshot_execution_config`.

That strictness is intentional:

- It prevents incomplete snapshots from entering runtime activation.
- It avoids hidden defaults that users did not publish into the snapshot.
- It keeps future order execution consistent with snapshot truth.

The backfill script should fail closed for ambiguous rows. If a snapshot is missing broad deployment execution objects, or appears to be official-template owned, it should report a skip reason instead of writing.

## Tests

Publication tests:

- Perpetual LLM publication produces `deploymentExecutionDefaults.tdMode = "cross"`.
- Perpetual LLM publication produces `deploymentExecutionConstraints.supportedTdModes = ["cross"]`.
- Spot LLM publication does not include `tdMode` or `supportedTdModes`.
- Strategy Plaza edit session remains a normal codegen session path, so publication coverage applies to it.

Backfill tests:

- Dry-run reports eligible LLM perpetual snapshots without writing.
- Apply repairs eligible snapshot defaults and constraints.
- Apply synchronizes bound strategy instance config and params when present.
- Official Strategy Plaza snapshots are skipped.
- Spot snapshots are skipped.
- Snapshots with existing valid `tdMode` are skipped.

Verification should run the focused quantify unit tests for publication and backfill, plus TypeScript compile for quantify if the touched files affect exported types.

## Rollout

1. Merge code fix and backfill script.
2. Deploy quantify/backend artifacts to staging.
3. Run LLM tdMode backfill in dry-run against staging quantify database.
4. Review pending rows.
5. Run apply once.
6. Retry one-click deploy for the failed staging snapshot or regenerate/redeploy an equivalent perpetual strategy.

## Success Criteria

- New LLM-generated perpetual snapshots contain explicit cross-margin trade mode.
- Strategy Plaza edit-generated perpetual snapshots deploy successfully after publish/backtest.
- Existing eligible staging LLM perpetual snapshots can be repaired without touching official template snapshots.
- Spot strategy publication and deploy behavior remain unchanged.
- Deploy validation continues to reject incomplete perpetual snapshots.
