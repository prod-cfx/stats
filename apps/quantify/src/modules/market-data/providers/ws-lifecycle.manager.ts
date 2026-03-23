import WebSocket from 'ws'

interface WsLifecycleOptions<TKey extends string> {
  getReconnectDelayMs: () => number
  onScheduleReconnect: (key: TKey, delayMs: number) => void
}

export class WsLifecycleManager<TKey extends string> {
  private readonly wsByKey: Partial<Record<TKey, WebSocket>> = {}
  private readonly reconnectTimerByKey: Partial<Record<TKey, NodeJS.Timeout>> = {}
  private shouldReconnect = false

  constructor(private readonly options: WsLifecycleOptions<TKey>) {}

  setShouldReconnect(shouldReconnect: boolean): void {
    this.shouldReconnect = shouldReconnect
  }

  isReconnectEnabled(): boolean {
    return this.shouldReconnect
  }

  registerSocket(key: TKey, ws: WebSocket): void {
    this.wsByKey[key] = ws
  }

  getSocket(key: TKey): WebSocket | undefined {
    return this.wsByKey[key]
  }

  async closeSocket(key: TKey): Promise<void> {
    const timer = this.reconnectTimerByKey[key]
    if (timer) {
      clearTimeout(timer)
      this.reconnectTimerByKey[key] = undefined
    }

    const ws = this.wsByKey[key]
    if (!ws) return

    if (ws.readyState === WebSocket.OPEN) {
      await new Promise<void>(resolve => {
        ws.once('close', () => resolve())
        ws.close()
      })
    } else {
      ws.close()
    }

    this.wsByKey[key] = undefined
  }

  async closeMany(keys: readonly TKey[]): Promise<void> {
    await Promise.all(keys.map(key => this.closeSocket(key)))
  }

  scheduleReconnect(key: TKey, reconnect: () => Promise<void> | void): void {
    if (!this.shouldReconnect) return
    if (this.reconnectTimerByKey[key]) return

    const delayMs = this.options.getReconnectDelayMs()
    this.options.onScheduleReconnect(key, delayMs)

    this.reconnectTimerByKey[key] = setTimeout(async () => {
      this.reconnectTimerByKey[key] = undefined
      await reconnect()
    }, delayMs)
  }
}
