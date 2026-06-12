# Mobile AI Quant Published Session Reuse Design

## Background

Mobile AI Quant confirmation currently calls `confirmStrategy(confirmGenerate: true)` when the user taps the confirmation CTA. This works for first-time confirmation, but it also runs when the loaded codegen session is already `PUBLISHED` and already carries a `publishedSnapshotId` and generated script artifacts.

The observed mobile error is:

```text
ApiException(status=409, code=CONFLICT, message=回测请求冲突，可能已有相同回测任务正在处理。请稍后重试。)
```

This is most likely a duplicate backtest submission conflict. Leaving the mobile flow after submitting a backtest can leave the backend job queued or running. Re-entering the flow and submitting the same backtest again can trigger `409 CONFLICT`. The exit is not the backend error itself; it is one common way to produce a duplicate retry.

Front already treats published strategy artifacts as reusable state. It restores codegen sessions, preserves published snapshot data, and blocks backtest unless the conversation has a confirmed graph plus latest published code. Mobile should follow the same backend contract shape while keeping its lighter interaction model.

## Goals

- Reuse an already published mobile codegen session instead of confirming and generating again.
- Preserve the existing backend and front contracts; do not require backend changes.
- Keep mobile flow focused on the data it already needs: published snapshot id, script code, snapshot params, strategy config, backtest defaults, deployment defaults, and compatibility metadata.
- Avoid showing raw `ApiException(...)` text for duplicate backtest conflicts.

## Non-Goals

- Do not change front behavior.
- Do not add backend endpoints or alter response DTOs.
- Do not build full front-style conversation editing on mobile.
- Do not make mobile display every front-only diagnostic field.

## Front Reference

Front uses these rules as the source of truth:

- `hasLatestPublishedCode(conversation)` returns true only when a confirmed graph version matches `publishedScriptGraphVersion` and `publishedSnapshotId` is present.
- `requiresRepublishForPublishedSnapshot(...)` requires republish when compatibility metadata says `requiresRepublishForBacktest`, or when non-backtest execution params drift away from the published snapshot.
- `getCodegenSessionReconciliationAction(...)` applies server terminal states, restarts irrecoverable or digest-mismatched sessions, and otherwise reuses the current codegen session.
- During codegen `409` terminal-session conflicts, front fetches the current session and recovers if it is already terminal.
- During backtest, front blocks unless graph is confirmed and latest published code exists, then submits a job and polls it.

Mobile does not need the full graph-version model for this fix. Its equivalent guard can be narrower: an existing session with `status == PUBLISHED` and non-empty `publishedSnapshotId` is reusable for the current mobile flow, unless compatibility metadata explicitly requires republish for the next action.

## Design

### Confirm Page Reuse Guard

`apps/quantify-mobile/lib/pages/ai/ai_confirm_page.dart` should check the loaded `_session` before calling `confirmStrategy`.

If `_session` is reusable:

- `status == CodegenSessionResponseDtoStatusEnum.PUBLISHED`
- `publishedSnapshotId` is non-empty
- compatibility metadata does not require republish for the next action

then mobile opens `AiPublishedStrategyContext.fromCodegen(_session)` directly. It must not call `confirmStrategy` again.

If `_session` is not reusable:

- `CONFIRM_GATE` continues to call `confirmStrategy` and advance through the confirm gate.
- processing statuses continue to poll until `PUBLISHED` or terminal failure.
- missing `publishedSnapshotId` remains a local blocking error.
- explicit republish-required metadata shows a clear mobile message and then uses the existing confirmation path only when republishing is valid.

### Script Context

`AiPublishedStrategyContext` already carries the fields mobile needs:

- `codegenSessionId`
- `conversationId`
- `strategyInstanceId`
- `publishedSnapshotId`
- `scriptCode`
- `snapshotParamValues`
- `strategyConfig`
- `backtestConfigDefaults`
- `deploymentExecutionDefaults`
- `deploymentExecutionConstraints`
- `compatibilityMetadata`

No new model fields are required. The confirm page should rely on `hasPublishedSnapshot`, `hasScript`, `requiresRepublishForBacktest`, and `requiresRepublishForDeploy` where possible.

### Backtest Conflict Message

When a duplicate backtest conflict reaches mobile, UI should show a user-facing message instead of raw exception text:

```text
已有相同回测任务正在处理中，请稍后查看结果或重试。
```

This first pass does not need to recover the active job id. It only prevents a broken-looking raw exception and explains what happened.

### Future Recovery Path

The next enhancement can restore `lastBacktestRef` in mobile like front does. That would let mobile show a completed previous result when the snapshot and backtest config still match. This is useful but not required to unblock deployment submission.

## Data Flow

1. User returns to mobile confirm page with a stored or loaded codegen session.
2. Confirm page loads current `CodegenSessionResponseDto`.
3. Confirm CTA checks whether current session is already published and reusable.
4. If reusable, mobile routes to script/backtest using `AiPublishedStrategyContext.fromCodegen`.
5. If not reusable, mobile calls existing `confirmStrategy`, advances `CONFIRM_GATE`, waits for `PUBLISHED`, then routes forward.
6. Backtest receives `publishedSnapshotId` from the context and submits the real job payload.
7. If backend returns duplicate-job `409`, mobile renders the friendly conflict message.

## Error Handling

- Missing session id: keep existing local error asking the user to return to AI chat.
- Published session without `publishedSnapshotId`: block locally with a clear missing snapshot message.
- Terminal failure or rejected codegen: show reject reason when present; otherwise show generic publish failure.
- Duplicate backtest conflict: show friendly conflict text and keep the user on the current step.
- Unknown API errors: preserve existing error handling.

## Testing

Add or update focused mobile tests:

- Published session with `publishedSnapshotId` skips `confirmStrategy` and opens script context.
- `CONFIRM_GATE` still calls `confirmStrategy`.
- Published session missing `publishedSnapshotId` is blocked locally.
- Republish-required compatibility metadata does not silently reuse stale artifacts.
- Backtest `409 CONFLICT` renders friendly text and does not expose `ApiException(...)`.

Run focused verification after implementation:

```bash
flutter analyze --no-pub
flutter test --no-pub --reporter expanded test/data/api_backtest_repository_test.dart test/pages/ai_confirm_page_test.dart test/data/api_ai_chat_repository_test.dart test/widgets/qz_deploy_sheet_test.dart
```

## Acceptance Criteria

- Re-entering a published mobile strategy confirmation does not regenerate or reconfirm the script.
- Mobile can continue to script, backtest, and deploy from the existing published snapshot.
- Duplicate backtest conflict no longer displays raw `ApiException(...)`.
- Existing front behavior and backend contracts remain unchanged.

Refs: #2427
