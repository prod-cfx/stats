# React Doctor Split Plan Critic Round 1

## Verdict

Pass with minor notes. No Critical or Major blockers.

## Checks

- PR topology: Single PR is valid. Changes stay in `apps/front`; no data-flow producer/consumer split required.
- Scope: Plan targets only React Doctor warning reduction for the named components and avoids unrelated UI or API behavior changes.
- Existing paths: `AiQuantStrategyDetail.tsx` and `ProfileDataTabs.tsx` exist. `TradingViewLightweightChart.tsx` does not exist; plan correctly maps work to `trading/center-chart-panel/TradingViewChart.tsx` and requires PR body disclosure.
- Verification: Plan includes the required React Doctor, lint, front build, and front unit test commands.
- Risk: Main risk is accidental UI behavior drift from extracting render blocks. Plan keeps fetch/action logic in containers and only extracts pure render/helper boundaries.

## Minor Notes

- Prefer reducer only for `ProfileDataTabs` tab/sort/filter interaction state; do not combine history or trades loading state into that reducer unless it removes direct cascading updates without increasing coupling.
- If React Doctor install fails because of npm registry metadata, record exact command/error in PR body and still run all other checks.
