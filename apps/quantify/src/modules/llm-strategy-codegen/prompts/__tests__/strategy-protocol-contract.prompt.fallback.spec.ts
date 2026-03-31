describe('strategyProtocolContractPrompt fallback', () => {
  afterEach(() => {
    jest.resetModules()
    jest.dontMock('node:module')
  })

  it('uses workspace fallback when @ai/shared cannot be resolved at runtime', () => {
    jest.isolateModules(() => {
      jest.doMock('node:module', () => ({
        createRequire: () => ({
          resolve: () => {
            throw new Error("Cannot find module '@ai/shared'")
          },
        }),
      }))

      // eslint-disable-next-line ts/no-require-imports
      const { buildStrategyProtocolTypeContractPrompt } = require('../strategy-protocol-contract.prompt')

      expect(() => buildStrategyProtocolTypeContractPrompt()).not.toThrow()
    })
  })
})
