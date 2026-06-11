# Mobile AI Confirm Intent Design

## Background

Mobile AI quant chat already receives codegen metadata from the backend, but the UI only opens the confirm flow when the assistant turn is rendered as a params card with an explicit confirm CTA. If the user replies with a short confirmation such as `是`, the message is sent as a normal chat turn and does not enter the confirm strategy/script flow.

## Goal

When the latest assistant response is asking for strategy confirmation and carries codegen metadata, a user reply like `是` should open the existing `/ai/confirm` flow. The assistant bubble should also show the confirm CTA whenever codegen metadata is available, even if the backend response is not classified as a params card.

## Design

- Add a small confirm-intent detector in the AI home UI layer. It matches short Chinese confirmation replies such as `是`, `确认`, `可以`, `生成脚本`, and `开始`.
- Before sending a normal chat message, inspect the current session's latest assistant turn. If it has `codegenSessionId` or can fall back to session-level codegen metadata, and the input matches confirm intent, route to `_openConfirm` instead of calling `sendMessageTo`.
- Render the confirm CTA for any assistant turn with codegen metadata, not only `ChatTurnKind.params`. Params display remains unchanged; the CTA becomes a separate affordance for confirmable assistant text.
- Keep all backend contracts unchanged. The existing confirm page still calls `confirmStrategy(... confirmGenerate=true ...)` and then moves into the script step.

## Error Handling

- If no codegen metadata is available, the input remains a normal chat message.
- If the latest assistant turn is already deployed or the session is locked, the CTA stays hidden.

## Testing

- Add widget coverage for short confirm input opening `/ai/confirm` instead of appending a normal message.
- Add bubble/page coverage that a non-params assistant turn with codegen metadata shows the confirm CTA.
- Keep existing AI confirm/script/deploy tests passing.
