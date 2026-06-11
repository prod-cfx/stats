# Mobile AI Home Load Error Design

## Background

After mobile AI quant moved from mock chat data to real backend repositories, the AI tab depends on `AiChatRepository.listSessions()` during the first frame. The page shows a spinner while `AiHomePageState.initialized == false`.

## Problem

If `listSessions()` throws because the user is not logged in, the endpoint fails, the request times out, or the response shape is not parseable, the exception escapes `AiHomePageController.loadSessions()`. The state never flips to initialized, so the AI tab stays in an infinite loading state.

## Design

- Extend `AiHomePageState` with `loadError`.
- In `AiHomePageController.loadSessions()`, catch errors from `listSessions()` and set `initialized=true`, empty sessions, and `loadError` to the normalized error text.
- Clear `loadError` when a later load succeeds.
- In `AiHomePage`, render an error state when `initialized=true`, there is no current session, and `loadError` is present. The error state shows the existing `commonLoadError` text, the error detail, a retry button, and the existing new-session action.
- Retry calls the same `_loadSessions()` path, so successful retry restores normal behavior.

## Testing

- Controller test: failed `listSessions()` sets `initialized=true` and preserves an error message.
- Widget test: failed first load no longer leaves the spinner visible and exposes retry.
- Existing AI chat tests remain unchanged for successful loads.

## Scope

This change does not alter backend contracts and does not reintroduce mock data fallback. It only prevents UI deadlock on first-load failure.
