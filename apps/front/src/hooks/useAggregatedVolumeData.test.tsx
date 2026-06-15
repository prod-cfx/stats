/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { fetchKlineData } from '@/lib/api'
import { useAggregatedVolumeData } from './useAggregatedVolumeData'

jest.mock('@/lib/api', () => ({
  fetchKlineData: jest.fn(),
}))

jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}))

interface Bar {
  time: number
  volume: number
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, reject, resolve }
}

describe('useAggregatedVolumeData', () => {
  let host: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  const mockedFetchKlineData = jest.mocked(fetchKlineData)

  function Probe(props: { symbol: string }) {
    const { data } = useAggregatedVolumeData({ symbol: props.symbol, interval: '1m' })
    return <output data-testid="data">{data.map(item => `${item.time}:${item.volume}`).join(',')}</output>
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    mockedFetchKlineData.mockReset()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    host.remove()
  })

  it('starts a new key request while the previous key is still in flight', async () => {
    const btc = deferred<Bar[]>()
    const eth = deferred<Bar[]>()
    mockedFetchKlineData
      .mockReturnValueOnce(btc.promise)
      .mockReturnValueOnce(eth.promise)

    await act(async () => {
      root.render(<Probe symbol="BTC" />)
    })
    await act(async () => {
      root.render(<Probe symbol="ETH" />)
    })

    expect(mockedFetchKlineData).toHaveBeenCalledTimes(2)
    expect(mockedFetchKlineData).toHaveBeenNthCalledWith(2, expect.objectContaining({ symbol: 'ETH' }))

    await act(async () => {
      btc.resolve([{ time: 1, volume: 10 }])
      await btc.promise
    })
    expect(host.querySelector('[data-testid="data"]')?.textContent).toBe('')

    await act(async () => {
      eth.resolve([{ time: 2, volume: 20 }])
      await eth.promise
    })
    expect(host.querySelector('[data-testid="data"]')?.textContent).toBe('2:20')
  })
})
