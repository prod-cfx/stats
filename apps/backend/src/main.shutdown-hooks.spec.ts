import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('backend bootstrap shutdown hooks', () => {
  it('enables Nest shutdown hooks during bootstrap', () => {
    const source = readFileSync(resolve(__dirname, 'main.ts'), 'utf8')

    expect(source).toContain('app.enableShutdownHooks()')
  })
})
