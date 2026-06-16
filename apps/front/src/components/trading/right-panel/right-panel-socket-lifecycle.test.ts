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
    expect(source.slice(effectStart, socketCreation)).toContain('setLoading(true)')
  })
})
