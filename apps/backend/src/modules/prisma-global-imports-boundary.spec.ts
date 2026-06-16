import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'

function collectModuleFiles(dir: string): string[] {
  return readdirSync(dir)
    .flatMap((entry) => {
      const fullPath = join(dir, entry)
      if (statSync(fullPath).isDirectory())
        return collectModuleFiles(fullPath)

      return fullPath.endsWith('.module.ts') ? [fullPath] : []
    })
}

function findPrismaModuleImportOffenders(modulesRoot: string): string[] {
  const prismaImportPattern = /from ['"](?:@\/prisma\/prisma\.module|(?:\.\.\/)+prisma\/prisma\.module)['"]/u
  const rootAppModule = join(modulesRoot, 'app.module.ts')

  return collectModuleFiles(modulesRoot)
    .filter(filePath => filePath !== rootAppModule)
    .filter(filePath => prismaImportPattern.test(readFileSync(filePath, 'utf8')))
    .map(filePath => relative(modulesRoot, filePath))
    .sort()
}

describe('backend PrismaModule import boundary', () => {
  it('keeps PrismaModule imported only by AppModule under runtime modules', () => {
    const modulesRoot = __dirname

    const offenders = findPrismaModuleImportOffenders(modulesRoot)

    expect(offenders).toEqual([])
  })

  it('does not exempt nested modules named app.module.ts', () => {
    const modulesRoot = mkdtempSync(join(tmpdir(), 'prisma-boundary-'))
    const featureDir = join(modulesRoot, 'feature')
    mkdirSync(featureDir)
    writeFileSync(
      join(featureDir, 'app.module.ts'),
      "import { PrismaModule } from '../../prisma/prisma.module'\n",
    )

    try {
      const offenders = findPrismaModuleImportOffenders(modulesRoot)

      expect(offenders).toEqual(['feature/app.module.ts'])
    }
    finally {
      rmSync(modulesRoot, { recursive: true, force: true })
    }
  })
})
