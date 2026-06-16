import {
  compareProfileSortableValues,
  createHistoryOrdersState,
  getCurrentWalletHistoryOrders,
  historyOrdersReducer,
  shouldReuseHistoryOrders,
} from './ProfileDataTabs'

describe('profile data tabs state helpers', () => {
  it('keeps equal sortable values stable', () => {
    expect(compareProfileSortableValues(42, 42, 'desc')).toBe(0)
    expect(compareProfileSortableValues('$ 12.00', '$ 12.00', 'asc')).toBe(0)
  })

  it('does not reuse history orders across wallet addresses', () => {
    const initial = createHistoryOrdersState(50)
    const loaded = historyOrdersReducer(initial, {
      type: 'success',
      orders: [],
      renderStep: 50,
      walletAddress: '0xabc',
    })

    expect(shouldReuseHistoryOrders(loaded, '0xabc')).toBe(true)
    expect(shouldReuseHistoryOrders(loaded, '0xdef')).toBe(false)
  })

  it('does not expose previous wallet history orders while wallet changes', () => {
    const initial = createHistoryOrdersState(50)
    const loaded = historyOrdersReducer(initial, {
      type: 'success',
      orders: [
        {
          time: '2026年6月16日',
          timestamp: 1,
          asset: 'BTC',
          type: 'limit',
          side: 'Buy',
          amount: '1 BTC',
          price: '$ 1.00',
          trigger: '-',
          status: 'filled',
          id: '# 1',
        },
      ],
      renderStep: 50,
      walletAddress: '0xabc',
    })

    expect(getCurrentWalletHistoryOrders(loaded, '0xdef')).toBeNull()
  })
})
