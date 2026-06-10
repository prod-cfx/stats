# Mobile Aggregated Market Data Real API Design

## Context

`apps/front` already renders aggregated orderbook, aggregated open interest, and aggregated volume from backend APIs on `/aggregated-orderbook`. The mobile app has the same three data tabs under the bottom navigation `Data` tab, but mobile intentionally shows a smaller data surface than front because of screen and interaction constraints.

`apps/quantify-mobile` already has an `ApiAggOrderbookRepository` and generated Dart contracts in `packages/api-contracts-dart`. The current mobile path is partly connected to real APIs, but some UI choices do not drive requests and the volume snapshot path still bypasses the generated `MarketsApi` method.

## Scope

Implement the approved option B: keep the current mobile UI and display scope, but make the existing mobile controls drive real backend contract data.

In scope:

- Aggregated orderbook uses the generated Dart `OrderbookApi` and refreshes when the mobile orderbook coin or market type changes.
- Aggregated open interest uses the existing backend snapshot contract `/open-interest/aggregate/{symbol}` through generated Dart contracts, with adapter-level deserialization for its `JsonObject data` shape.
- Aggregated volume uses the generated Dart `MarketsApi.marketsControllerGetAggregatedVolumeSnapshot` method instead of manual path-based `dio.get` calls.
- Coin chips and current mobile tables remain within the current mobile data surface.
- Empty or missing snapshot data shows existing empty states and does not fall back to mock fixtures.

Out of scope:

- Backend changes.
- Contract regeneration or generated Dart source edits.
- Adding front-only columns or desktop comparison layouts to mobile.
- Changing front behavior.

## Architecture

Keep `AggOrderbookRepository` as the single repository boundary for the three mobile tabs. Extend the repository API so callers can request data for a concrete orderbook market, for example base symbol and market type. The implementation remains `ApiAggOrderbookRepository`, backed by `GeneratedBackendApi` and `packages/api-contracts-dart`.

Use a provider family for market-specific aggregated data so UI state becomes request input instead of display-only state. The page-level widgets still consume `AggMarketData`; the provider layer is responsible for choosing which request parameters build that bundle.

Generated APIs used:

- `OrderbookApi.aggregatedOrderbookControllerGetAggregatedOrderbook(base_, type, depth, tickSize)` for orderbook levels and venues.
- `DefaultApi.openInterestControllerGetAggregateSnapshot(symbol)` for open interest snapshots.
- `MarketsApi.marketsControllerGetAggregatedVolumeSnapshot(symbol)` for volume snapshots.
- `OrderbookApi.aggregatedOrderbookControllerGetAvailableMarkets()` for available orderbook markets where useful.

## Data Flow

`AggOrderbookCard` owns the current orderbook base and market type state. Those values feed the aggregated data provider, which calls the repository with normalized parameters such as `BTC/perp` or `ETH/spot`. Returned `venues`, `asks`, and `bids` continue to map into existing `AggBookLevel` and `AggExchange` models.

`AggOpenInterestTab` and `AggVolumeTab` keep their current chip interaction. When the user selects a chip, the selected symbol resolves data from the same real data bundle or from a symbol-specific provider. Existing row models remain unchanged: mobile shows OI total, per-exchange share, USD/quantity, and 24h change; mobile volume shows total and per-exchange value bars.

Because backend responses are globally wrapped by `TransformInterceptor`, adapter-level unwrap remains allowed. This is especially important for endpoints whose generated Dart method type does not exactly match the runtime envelope. The unwrap and deserialization logic stays inside `ApiAggOrderbookRepository`; widgets never parse backend envelopes.

## Error Handling

Orderbook failure makes the orderbook section render the current empty orderbook fallback. OI or volume failures for a single symbol are treated as missing data for that symbol, so other tabs and symbols can still render.

404 and empty snapshot responses become empty chip data or existing empty states. Network and serialization failures remain visible to tests and logs through repository behavior, but the UI does not import mock fixtures or synthesize fake production data.

## Testing

Repository tests cover:

- Orderbook request parameters for base and market type.
- Mapping generated orderbook DTOs into mobile levels and exchanges.
- OI `JsonObject data` deserialization into `OiAggregateSnapshotDto`.
- Volume snapshot through the generated `MarketsApi` method, including runtime envelope unwrapping if needed.
- Empty or failed per-symbol snapshots do not produce mock fixture data.

Widget/provider tests cover:

- Switching orderbook coin or market type changes provider request input.
- OI and volume chip selection renders the selected symbol data.
- Existing empty states appear when selected symbols have no data.

Verification should run focused Flutter tests for changed mobile files first, then the relevant build or broader mobile checks if the change surface requires it.

