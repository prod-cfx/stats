# Crypto 90%+ Coverage Evidence

## Claim

- Target: 90%+ of executable B-scope crypto strategy families in the repository acceptance corpus.
- Current proof denominator: `B_supported_strategy_families`.
- Current generated report source: `CRYPTO_STRATEGY_COVERAGE_CORPUS`.
- Corpus size: 50 cases, including 46 executable B-scope cases and 4 fail-closed C-scope unsupported cases.
- External exchange/user market-share proof is not claimed here. This proof is repository corpus and historical acceptance corpus evidence.

## Taxonomy Weights

| Family | Weight | Source rationale |
| --- | ---: | --- |
| `trend_breakout_momentum` | 24% | EMA crosses, breakout, momentum, threshold, slope and volume-confirmation cases are the largest reusable Stage4 strategy surface. |
| `mean_reversion_oscillator` | 13% | RSI and boundary-reversion cycles from historical acceptance cases. |
| `grid_range` | 8% | Range and grid automation cases, including fixed-grid programs. |
| `dca_position_scaling` | 10% | Scheduled DCA, pyramiding, martingale, budget caps, leverage and fixed-notional sizing. |
| `portfolio_risk_governance` | 12% | Drawdown, daily loss, exposure cap, concurrent-position cap and kill-switch governance. |
| `multi_context_scope` | 9% | Multi-timeframe, multi-symbol and multi-leg scope support without cross-exchange fund movement. |
| `crypto_data_sources` | 8% | Orderbook, funding, open interest, liquidation and webhook/external signal inputs. |
| `execution_lifecycle` | 10% | Limit, conditional, reduce-only, post-only, limit-chase, close, reduce and reverse action lifecycle. |
| `execution_programs` | 6% | TWAP, DCA, rebalance, iceberg, martingale and fixed-grid execution templates. |

Total B denominator: 100%.

## Unsupported C-Scope

These cases must fail-closed and are excluded from executable B denominator:

| Family | Reason |
| --- | --- |
| `unsupported_cross_exchange_transfer_arbitrage` | Requires automated cross-exchange fund movement and venue settlement controls. |
| `unsupported_triangular_arbitrage_matching` | Requires multi-leg atomic matching semantics beyond generic strategy rules. |
| `unsupported_hft_market_making` | Requires latency-sensitive colocated market-making runtime. |
| `unsupported_order_queue_alpha` | Requires queue-position alpha and microstructure runtime guarantees. |

## Evidence Generation

Run:

```bash
pnpm --filter @net/quantify exec tsx src/modules/llm-strategy-codegen/scripts/crypto-coverage-report.ts
```

Output:

- `apps/quantify/tmp/crypto-strategy-coverage-report.json`
- `apps/quantify/tmp/crypto-strategy-coverage-report.md`

The generated report contains:

- taxonomy target and achieved percentage
- family weights and source rationale
- all 50 corpus case mappings to taxonomy families
- unsupported C-scope reasons
- atom backlog, if any

## Guard Tests

`crypto-coverage-reporter.spec.ts` verifies:

- B taxonomy denominator sums to 100.
- C-scope unsupported families have zero denominator weight.
- all 50 corpus cases map to taxonomy families.
- every B taxonomy family has at least one passed case.
- taxonomy achieved coverage is at least 90%.
