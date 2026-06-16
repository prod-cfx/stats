import fs from 'node:fs'
import path from 'node:path'

const rightPanelPath = path.join(__dirname, 'RightPanel.tsx')

function readRightPanelSource() {
  return fs.readFileSync(rightPanelPath, 'utf8')
}

describe('right panel socket lifecycle', () => {
  it('sets loading before creating a replacement socket subscription', () => {
    const source = readRightPanelSource()
    const effectStart = source.indexOf('// WebSocket 连接管理 - Trades 实时数据')
    const socketCreation = source.indexOf('// 创建 Socket.IO 连接', effectStart)

    expect(effectStart).toBeGreaterThanOrEqual(0)
    expect(socketCreation).toBeGreaterThan(effectStart)
    expect(source.slice(effectStart, socketCreation)).toContain("type: 'loading-started'")
  })

  it('resets deterministic mock data from an effect instead of render', () => {
    const source = readRightPanelSource()

    expect(source).toContain('useReducer')
    expect(source).not.toContain('if (orderbookSource !== createDeterministicMock)')
    expect(source).not.toContain('setOrderbookSource(createDeterministicMock)')
    expect(source).toContain("type: 'mock-source-changed'")
  })

  it('resets stale market data when deterministic mock source changes', () => {
    const source = readRightPanelSource()
    const resetCaseStart = source.indexOf("case 'mock-source-changed':")
    const nextCaseStart = source.indexOf("case 'orderbook-received':", resetCaseStart)
    const resetCase = source.slice(resetCaseStart, nextCaseStart)

    expect(resetCaseStart).toBeGreaterThanOrEqual(0)
    expect(nextCaseStart).toBeGreaterThan(resetCaseStart)
    expect(resetCase).toContain('orderbook: action.source.initialOrderbook')
    expect(resetCase).toContain('trades: []')
    expect(resetCase).toContain('lastPrice: null')
    expect(resetCase).toContain('tickerData: null')
  })
})
