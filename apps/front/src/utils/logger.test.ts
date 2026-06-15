describe('logger', () => {
  const originalEnv = process.env
  let debugSpy: jest.SpyInstance
  let infoSpy: jest.SpyInstance
  let warnSpy: jest.SpyInstance
  let errorSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_LOG_LEVEL
    Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true })
    window.localStorage.clear()
    debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {})
    infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {})
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    debugSpy.mockRestore()
    infoSpy.mockRestore()
    warnSpy.mockRestore()
    errorSpy.mockRestore()
    process.env = originalEnv
  })

  it('does not output debug logs at the default production level', async () => {
    const { logger } = await import('./logger')

    logger.debug('hidden')

    expect(debugSpy).not.toHaveBeenCalled()
  })

  it('uses NEXT_PUBLIC_LOG_LEVEL to enable debug logs', async () => {
    process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug'
    const { logger } = await import('./logger')

    logger.debug('visible', { count: 1 })

    expect(debugSpy).toHaveBeenCalledWith('[DEBUG] visible', { count: 1 })
  })

  it('lets localStorage.logLevel override the env level', async () => {
    process.env.NEXT_PUBLIC_LOG_LEVEL = 'debug'
    window.localStorage.setItem('logLevel', 'error')
    const { logger } = await import('./logger')

    logger.warn('hidden warn')
    logger.error('visible error')

    expect(warnSpy).not.toHaveBeenCalled()
    expect(errorSpy).toHaveBeenCalledWith('[ERROR] visible error')
  })

  it('keeps info below warn hidden in production defaults', async () => {
    const { logger } = await import('./logger')

    logger.info('hidden info')

    expect(infoSpy).not.toHaveBeenCalled()
  })
})
