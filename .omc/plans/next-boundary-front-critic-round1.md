# Plan Critic Round 1: Next Boundary Front

## Scope

- Track: B single PR.
- Plan: `docs/superpowers/plans/2026-06-16-next-boundary-front.md`.
- Issue: #2512.

## Checks

- PR topology: single front-only PR is valid. No schema, writer/consumer data dependency, migration, RBAC, contracts, or irreversible operation.
- Real paths: referenced files exist; deleted root redirect client is no longer imported.
- Suspense/search-param boundary: plan removes `Navbar`'s unnecessary `useSearchParams` hook and wraps known page-private `useSearchParams` clients.
- Redirect: server-side `/en` redirect removes root client effect diagnostic. Search/hash preservation is intentionally not possible server-side for hash; issue asks client-side redirect count to drop, not preserve hash.
- Images: plan limits migration to bounded images in issue-listed files, avoiding broad remotePatterns churn.
- Metadata: plan covers all three listed pages.
- Verification: lint, front build, focused tests, and React Doctor command are listed.

## Findings

### Major: Page-level Navbar workaround could survive without removing the hook source

Initial plan tested a custom `NavbarBoundary`, but React Doctor's static rule can still report custom wrappers. Removing the unnecessary `Navbar` search-param hook is simpler and eliminates the propagation source.

Decision: fixed in plan by replacing the wrapper approach with `Navbar` reading `window.location.search` only inside the login click path, plus `rg -n "useSearchParams" apps/front/src/components/layout/Navbar.tsx` verification.

## Gate Decision

Critical: none.
Major: fixed.
Minor: none blocking.

Plan critic gate: pass.
