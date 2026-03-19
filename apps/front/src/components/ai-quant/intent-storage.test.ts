import { clearIntent, getIntent, setIntent } from './intent-storage'

describe('intent-storage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('supports set/get/clear with ttl', () => {
    setIntent({ type: 'run', strategyId: 'momentum-steady' })
    const got = getIntent(30 * 60 * 1000)
    expect(got?.type).toBe('run')

    clearIntent()
    expect(getIntent(30 * 60 * 1000)).toBeNull()
  })
})

