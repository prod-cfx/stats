# Mobile Auth Contract Error Design

## Background

`apps/front` already uses the real backend auth contract through the generated TypeScript client. Its auth helper unwraps backend response envelopes and preserves backend error messages from both top-level `{ code, message }` and nested `{ error: { code, message } }` shapes before the UI shows the failure.

`apps/quantify-mobile` has the correct high-level flow, but its auth service still hand-builds auth paths through `ApiClient`. `packages/api-contracts-dart` already contains generated Dart auth APIs and DTOs for login, email code, register, guest login, and Telegram exchange. Mobile login errors also need to preserve backend messages instead of falling back to generic Dio or stringified exception output.

Registration should not be fully enabled in the mobile UI yet. The register subpage remains visible, but a transparent overlay blocks submit interaction and shows a `coming soon` prompt. When backend registration readiness is confirmed, removing the overlay should be enough to enable the already-wired contract path.

## Goals

- Mobile auth service uses `packages/api-contracts-dart` generated `AuthApi` methods instead of hand-written auth endpoint paths.
- Email login code, email code verification, guest login, and Telegram login follow existing backend/front contracts without adding or changing backend routes.
- Mobile login error display surfaces backend business messages from nested and top-level error envelopes.
- Register UI remains present but is blocked by a transparent `coming soon` overlay, so no register request is sent from the UI.
- Existing session storage and `LoginSheetController` public behavior remain compatible.

## Non-Goals

- No backend API change.
- No generated Dart contract edit by hand.
- No redesign of the login sheet visual layout.
- No production enablement of mobile registration during this task.

## Architecture

`AuthService` will depend on `GeneratedBackendApi` rather than raw `ApiClient`. It will call `GeneratedBackendApi.client.getAuthApi()` and use generated methods:

- `authControllerLogin`
- `authControllerSendEmailLoginCode`
- `authControllerVerifyEmailLoginCode`
- `authControllerLoginGuest`
- `authControllerRegister`
- Telegram exchange methods already present in generated `AuthApi`

`service_providers.dart` will construct `AuthService` from `generatedBackendApiProvider`, matching the repository pattern already used by other real-contract mobile repositories.

`ApiAuthRepository` remains the session mapper. It will accept generated response objects and map `AuthResponseDto.accessToken` plus `AuthResponseDto.user` into `AuthSession`. It will keep its existing map-envelope compatibility for tests and older fakes.

The login sheet registration tab keeps existing form fields. A transparent blocking layer is added only over the register action area or register pane so taps show a `coming soon` SnackBar and do not call `submitRegister`. Removing this layer later enables the already-wired register contract path.

## Data Flow

Email code send:

`LoginSheet -> LoginSheetController.sendLoginCode -> SessionController.sendLoginCode -> AuthRepository.sendLoginCode -> AuthService.authControllerSendEmailLoginCode`

Email code login:

`LoginSheet -> LoginSheetController.submitEmailCode -> SessionController.loginEmailCode -> AuthRepository.loginWithCode -> AuthService.authControllerVerifyEmailLoginCode -> ApiAuthRepository maps AuthSession -> SessionController stores session`

Guest login:

`SessionController.loginGuest -> AuthRepository.loginGuest -> AuthService.authControllerLoginGuest -> ApiAuthRepository maps guest session`

Telegram login:

Mobile uses the generated Dart methods that correspond to front's current Telegram exchange contract. It does not introduce a mobile-only backend endpoint.

Register:

`AuthService.register` can call generated `authControllerRegister`, but the register UI overlay prevents normal users from reaching this path until the overlay is removed.

## Error Handling

`ApiException.fromDio` will parse error response bodies with this priority:

1. `data.error.message` and `data.error.code`
2. `data.message` and `data.code`
3. plain non-HTML response text
4. HTTP status fallback
5. Dio/network fallback

Status-based classification remains unchanged at the `ApiException` layer. `LoginSheetController` continues to pass errors through `ErrorRouter.normalize`, then shows the resulting message with the existing login/register/Telegram prefix.

If a generated SDK call fails during serialization or deserialization, the same Dio interceptor path will preserve the underlying `ApiException` when a response exists, and fall back to a readable SDK error message when it does not.

## Testing

- Unit test `ApiException.fromDio` with nested backend envelope `{ error: { code, message } }`.
- Unit test auth service/repository against a fake Dio or generated API response to verify generated auth methods are used and `AuthSession` is mapped correctly.
- Update login sheet tests to verify register overlay shows `coming soon` and does not call `AuthRepository.register`.
- Keep existing login sheet controller tests for email code success/failure and error epoch behavior.
- Validation commands: run focused Flutter tests for changed mobile auth files, then `dx lint` and the relevant mobile build/test command supported by this repo.

## Compatibility And Risk

- User-facing session shape remains unchanged: `AuthSession` fields and storage key stay the same.
- Backend contract compatibility improves because auth paths and DTOs come from `packages/api-contracts-dart`.
- Main risk is generated built_value response mapping. Keep map fallback and add focused tests around generated response objects.
- Register remains blocked at UI level, so existing users cannot accidentally hit incomplete registration behavior.

## Acceptance Criteria

- Mobile auth service no longer hand-builds login/email-code/guest auth endpoint bodies where generated Dart DTOs and methods exist.
- Backend nested auth error message appears in login SnackBar text.
- Register tab interaction shows `coming soon` and does not send a register request.
- Telegram login path uses existing generated contract methods that match front, with no backend API changes.
- Focused tests for auth contract mapping, nested error parsing, and register overlay pass.
