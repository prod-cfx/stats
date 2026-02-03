# 2025-02-03: Extract History Tab to CompletedTradesTable Component

## Decision

Extracted history tab rendering logic from ProfileDataTabs.tsx into a reusable CompletedTradesTable component.

## Rationale

- **Separation of concerns**: History tab had complex pagination, sorting, and rendering logic that made ProfileDataTabs difficult to maintain
- **Reusability**: CompletedTradesTable can now be reused in other parts of the application that display completed trade data
- **Testability**: Smaller, focused component is easier to unit test
- **Code organization**: ProfileDataTabs now focuses on tab switching and generic table structure, while CompletedTradesTable handles history-specific logic

## Implementation Details

### Created: CompletedTradesTable.tsx

- Minimal props interface: `fillsData: UserFillsResponse | null`
- Self-contained state management for pagination (`historyPage`, `HISTORY_PAGE_SIZE`)
- Inline SVG icons (no lucide-react dependency) - following project convention
- Complete table rendering (thead + tbody + empty state + load more button)
- Internal helper functions: `convertFillsToCompletedTrades`, `normalizeDateLabel`, `formatDurationLabel`, `renderSideBadge`

### Modified: ProfileDataTabs.tsx

- Removed history-specific code: `CompletedTrade` interface, `convertFillsToCompletedTrades`, `sortedCompletedTrades`, `paginatedCompletedTrades`, `historyPage`, `HISTORY_PAGE_SIZE`
- Added import: `import { CompletedTradesTable } from './CompletedTradesTable'`
- Conditional rendering: `activeTab === 'history' ? <CompletedTradesTable fillsData={fillsData} /> : <table>...</table>`
- Removed `activeTab === 'history'` from `showTimeColumn` calculation

## Trade-offs

- **Duplicate table structure**: CompletedTradesTable renders a full `<table>`, while ProfileDataTabs also renders a table for other tabs. This creates some structural duplication, but it's acceptable because:
  - History tab has different columns and rendering requirements
  - Avoids complex conditional logic inside the shared table structure
  - Makes the component self-contained and easier to understand

## Verification

- ✅ Build passes: `dx build front --dev`
- ✅ No TypeScript errors
- ✅ No runtime errors (verified by successful build)
- ✅ History tab UI/behavior preserved (rows + load more + empty state)

## Future Considerations

- If more tabs require similar table patterns, consider extracting a generic `DataTable` component that accepts columns and data as props
- Consider adding unit tests for CompletedTradesTable component

## 2026-02-03 - Reuse existing Hyperliquid client

- Decision: 没有新增新的“直连 Hyperliquid”数据层文件，直接复用已存在的 `apps/front/src/lib/hyperliquid-api.ts` + `apps/front/src/lib/api.ts` 的 `fetchTraderFullData(address)` 来拿 `fills`。
- Rationale: 该仓库已经有 userFills 调用与 DTO mapping；本需求仅补齐 UI 的 history tab 展示与本地分页。
