describe('contextSchemaPrompt fallback', () => {
  afterEach(() => {
    jest.resetModules()
    jest.dontMock('node:module')
  })

  it('uses embedded schema fallback when shared helpers types are unavailable at runtime', () => {
    jest.isolateModules(() => {
      jest.doMock('node:module', () => ({
        createRequire: () => ({
          resolve: () => {
            throw new Error("Cannot find module '@ai/shared/script-engine/helpers'")
          },
        }),
      }))

      // eslint-disable-next-line ts/no-require-imports
      const { buildContextSchemaPrompt } = require('../context-schema.prompt')
      const prompt = buildContextSchemaPrompt()

      expect(prompt).toContain('interface Bar')
      expect(prompt).toContain('interface MultiLegStrategyContext')
      expect(prompt).toContain('ctx.paramsNormalized')
    })
  })
})
