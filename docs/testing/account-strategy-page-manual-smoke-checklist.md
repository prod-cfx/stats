# Account Strategy Page Manual Smoke Checklist

## Preconditions

1. Quantify service is running and reachable.
2. Front service is running and logged in with a valid test user.
3. Test data includes at least one strategy visible in list and detail.

## Checklist

1. Open `/account?tab=ai-quant` and confirm list renders without error state.
2. Pick one strategy and record list values:
- `status`
- `returnPct`
- `tradeCount`
- `updatedAt`
3. Click into detail page and verify the same strategy values are consistent with list and API.
4. Verify detail metric cards show:
- `收益率`
- `最大回撤`
- `胜率`
- `交易次数`
- `总收益额`
5. Verify `总收益额` equals pure PnL (not principal + PnL).
6. Trigger one action (`run` or `stop`) from list or detail.
7. Refresh list and detail pages and verify status converges to same value.
8. Record result and any mismatch in validation report.

## Evidence

1. Save one list screenshot and one detail screenshot.
2. Save one network response snapshot for list API and detail API.
3. Attach timestamps for action test before/after refresh.

