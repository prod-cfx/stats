describe('copyTextToClipboard', () => {
  let originalClipboard: Clipboard | undefined
  let execCommandSpy: jest.SpyInstance

  beforeEach(() => {
    jest.resetModules()
    originalClipboard = navigator.clipboard
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: jest.fn(),
    })
    execCommandSpy = jest.spyOn(document, 'execCommand').mockReturnValue(true)
  })

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    })
    execCommandSpy.mockRestore()
    Reflect.deleteProperty(document, 'execCommand')
    document.body.innerHTML = ''
  })

  it('uses navigator.clipboard.writeText first', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const { copyTextToClipboard } = await import('./clipboard')

    await expect(copyTextToClipboard('0xabc')).resolves.toBe(true)

    expect(writeText).toHaveBeenCalledWith('0xabc')
    expect(execCommandSpy).not.toHaveBeenCalled()
  })

  it('falls back to document.execCommand copy when clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    const { copyTextToClipboard } = await import('./clipboard')

    await expect(copyTextToClipboard('0xdef')).resolves.toBe(true)

    expect(execCommandSpy).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('falls back to document.execCommand copy when clipboard write is rejected', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('permission denied'))
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const { copyTextToClipboard } = await import('./clipboard')

    await expect(copyTextToClipboard('0xghi')).resolves.toBe(true)

    expect(writeText).toHaveBeenCalledWith('0xghi')
    expect(execCommandSpy).toHaveBeenCalledWith('copy')
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('removes the fallback textarea when execCommand throws', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })
    execCommandSpy.mockImplementation(() => {
      throw new Error('copy denied')
    })
    const { copyTextToClipboard } = await import('./clipboard')

    await expect(copyTextToClipboard('0xjkl')).resolves.toBe(false)

    expect(document.querySelector('textarea')).toBeNull()
  })
})
