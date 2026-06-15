import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

describe('PrismaService shutdown lifecycle', () => {
  const source = readFileSync(resolve(__dirname, 'prisma.service.ts'), 'utf8')

  it('disconnects after module destroy hooks have drained shutdown work', () => {
    expect(source).toContain('async beforeApplicationShutdown()')
    expect(source).not.toContain('async onModuleDestroy()')
    expect(source).not.toContain('enableShutdownHooks(')
    expect(source).not.toContain("$on('beforeExit'")
  })
})
