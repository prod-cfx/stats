# JWT Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten backend JWT access token defaults and add ordinary user refresh-token flow without breaking existing login/register clients.

**Architecture:** Keep tokens stateless. `jwtConfig` becomes source of access/refresh TTLs, auth services sign explicit `tokenType` payloads, and `JwtStrategy` rejects refresh tokens on protected routes while accepting legacy access tokens with no `tokenType`.

**Tech Stack:** NestJS 11, `@nestjs/jwt`, Swagger DTOs, Jest unit tests, `dx` verification commands.

---

## Files

- Modify: `apps/backend/src/config/configuration.ts` - add `jwt.accessExpiresIn` and `jwt.refreshExpiresIn`, retain legacy `jwt.expiresIn` compatibility with short default.
- Modify: `apps/backend/src/modules/auth/auth-access.module.ts` - register `JwtModule.signOptions.expiresIn` from `jwt.accessExpiresIn`.
- Modify: `apps/backend/src/modules/auth/interfaces/jwt-payload.interface.ts` - add optional `tokenType` for access/refresh distinction.
- Modify: `apps/backend/src/modules/auth/strategies/jwt.strategy.ts` - reject refresh tokens used as bearer access tokens.
- Create: `apps/backend/src/modules/auth/dto/requests/refresh-token.request.dto.ts` - user refresh request body.
- Modify: `apps/backend/src/modules/auth/dto/responses/auth.response.dto.ts` - add optional `refreshToken` and `expiresIn`.
- Modify: `apps/backend/src/modules/auth/auth.controller.ts` - add `POST /auth/refresh` public route.
- Modify: `apps/backend/src/modules/auth/services/user-auth.service.ts` - sign access/refresh token pair and implement refresh validation.
- Modify: `apps/backend/src/modules/auth/repositories/user-auth.repository.ts` - expose role-assignment lookup already needed by refresh through existing method; no new DB access unless required by tests.
- Modify: `apps/backend/src/modules/admin/services/admin-user.service.ts` - read admin access TTL from `jwt.accessExpiresIn` and refresh TTL from `jwt.refreshExpiresIn`.
- Test: `apps/backend/src/modules/auth/services/user-auth.service.beta-code.spec.ts` - add user token pair and refresh tests.
- Test: `apps/backend/src/modules/auth/auth.controller.spec.ts` - assert refresh route is not afterCommit-marked and delegates to service.
- Test: `apps/backend/src/modules/auth/strategies/jwt.strategy.spec.ts` - add refresh-token bearer rejection and legacy access compatibility coverage.
- Test: `apps/backend/src/config/configuration.spec.ts` - cover JWT default TTLs.
- Generated: `packages/api-contracts/src/generated/backend.ts` and Dart contracts if `dx build contracts` regenerates them.

## Steps

- [ ] **Step 1: Write failing JWT config tests**

Add `apps/backend/src/config/configuration.spec.ts` tests that load `jwtConfig()` with no JWT TTL env and expect `accessExpiresIn === '30m'`, `refreshExpiresIn === '7d'`, and `expiresIn === '30m'` for compatibility. Run `dx test unit backend apps/backend/src/config/configuration.spec.ts`; expected FAIL because fields/defaults are absent or still `30d`.

- [ ] **Step 2: Implement config and module TTL source**

Update `jwtConfig` to compute `accessExpiresIn = JWT_ACCESS_EXPIRES_IN ?? JWT_EXPIRES_IN ?? '30m'`, `refreshExpiresIn = JWT_REFRESH_EXPIRES_IN ?? '7d'`, keep `expiresIn: accessExpiresIn`, and set numeric `accessExpiration` fallback to `30 * 60`. Update `AuthAccessModule` to use `jwt.accessExpiresIn` fallback `30m`. Re-run Step 1 test; expected PASS.

- [ ] **Step 3: Write failing user auth token-pair and refresh tests**

In `apps/backend/src/modules/auth/services/user-auth.service.beta-code.spec.ts`, extend mocks with `JwtService.verifyAsync`, `UserAuthRepository.findUserById`, and `ConfigService` keys `jwt.accessExpiresIn`/`jwt.refreshExpiresIn`. Add tests for login/register auth responses containing `accessToken`, `refreshToken`, `expiresIn`, access payload `tokenType: 'access'`, refresh payload `tokenType: 'refresh'`; add refresh tests for valid user refresh token returning a rotated pair and invalid access token payload throwing `AUTH_UNAUTHORIZED`. Run `dx test unit backend apps/backend/src/modules/auth/services/user-auth.service.beta-code.spec.ts`; expected FAIL because refresh is missing and response lacks refresh token.

- [ ] **Step 4: Implement user token-pair and refresh service**

Add private helpers in `UserAuthService`: resolve access/refresh TTL strings from config, build base user payload, sign access with `tokenType: 'access'`, sign refresh with `tokenType: 'refresh'`. Add `refresh(refreshToken: string)` that verifies token, requires `principalType === 'user'`, `tokenType === 'refresh'`, and `sub`, loads user by id, validates `tokenVersion`, requires at least one role via `getUserRoles`, then returns `buildAuthResponse(user, roles)`. Re-run Step 3 test; expected PASS.

- [ ] **Step 5: Write failing controller/DTO tests**

Add user refresh DTO file and controller spec expectation before implementation: `AuthController.prototype.refresh` delegates `{ refreshToken }` to `userAuthService.refresh`, and `refresh` has no afterCommit metadata. Run `dx test unit backend apps/backend/src/modules/auth/auth.controller.spec.ts`; expected FAIL because route method is missing.

- [ ] **Step 6: Implement user refresh DTO and route**

Create `RefreshTokenRequestDto` with `@ApiProperty` and `@IsString()`. Add optional `refreshToken` and `expiresIn` properties to `AuthResponseDto`. Register DTO in `AuthController` imports and `@ApiExtraModels`; add `@Post('refresh')`, `@Public()`, `@UseGuards(AuthRateLimitGuard)`, `@HttpCode(HttpStatus.OK)`, Swagger body/response, and delegate to service. Re-run controller spec; expected PASS.

- [ ] **Step 7: Write failing strategy/admin TTL tests**

Create or extend `apps/backend/src/modules/auth/strategies/jwt.strategy.spec.ts` to verify `validate()` rejects payload `{ tokenType: 'refresh' }` with `AUTH_UNAUTHORIZED` and still accepts legacy user payload with no `tokenType` when user and role assignment exist. Add admin service focused tests if practical, or assert signAsync options through existing admin coverage. Run focused tests; expected FAIL because refresh bearer is accepted and admin TTL still reads `jwt.expiresIn`.

- [ ] **Step 8: Implement strategy rejection and admin TTL update**

Add `tokenType?: 'access' | 'refresh'` to `JwtPayload`. In `JwtStrategy.validate`, reject `payload.tokenType === 'refresh'` before DB work; leave `undefined` compatible. In `AdminUserService`, replace `jwt.expiresIn`/`JWT_EXPIRES_IN` access TTL reads with `jwt.accessExpiresIn` fallback `30m`, and refresh fallback with `jwt.refreshExpiresIn` fallback `7d`. Re-run focused tests; expected PASS.

- [ ] **Step 9: Build contracts and verify generated compatibility**

Run `dx build contracts` because Swagger DTO and route changed. Keep generated contract updates, and note compatibility: user auth responses only add optional fields; new `POST /api/v1/auth/refresh` endpoint is additive.

- [ ] **Step 10: Parallel final verification**

Run independent commands in parallel: `dx lint`, `dx build backend --dev`, and `dx test unit backend apps/backend/src/modules/auth apps/backend/src/modules/admin apps/backend/src/config`. If DTO/OpenAPI generated files changed, include `dx build contracts`. All must pass before commit/push/PR.

- [ ] **Step 11: Commit, push, create PR**

Commit with heredoc message and `Refs: #2568`; push `fix/2568-jwt-refresh`; create PR using repository template with `Closes: #2568` and `Refs: #2471`.

## Verify

- `dx lint`
- `dx build backend --dev`
- `dx test unit backend apps/backend/src/modules/auth apps/backend/src/modules/admin apps/backend/src/config`
- `dx build contracts`

## Commit

```bash
git add -A
git commit -F - <<'MSG'
fix: add user jwt refresh flow

变更说明：
- 缩短 backend JWT access 默认 TTL 并保留旧环境变量兼容
- 为普通用户新增 refresh token 签发与刷新入口
- 拒绝 refresh token 被当作 bearer access token 使用

Refs: #2568
MSG
```
