import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { NestFactory } from '@nestjs/core'
import { defaultEnvAccessor } from '../common/env/env.accessor'
import { AppModule } from '../modules/app.module'
import { buildSwaggerDocument } from './build-swagger-document'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { logger: ['error', 'warn'] })

  const document = buildSwaggerDocument(app)

  const findWorkspaceRoot = (startDir: string) => {
    let current = startDir
    while (true) {
      if (existsSync(join(current, 'pnpm-workspace.yaml'))) {
        return current
      }
      const parent = dirname(current)
      if (parent === current) return startDir
      current = parent
    }
  }

  const projectRoot = defaultEnvAccessor.raw('DX_PROJECT_ROOT')
  const workspaceRoot = projectRoot
    ? resolve(projectRoot)
    : findWorkspaceRoot(process.cwd())
  const outputDir = join(workspaceRoot, 'dist', 'openapi')
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true })
  }
  const outputPath = join(outputDir, 'backend.json')
  writeFileSync(outputPath, JSON.stringify(document, null, 2), 'utf8')
  await app.close()
  console.log(`OpenAPI schema exported to ${outputPath}`)
}

bootstrap().catch(err => {
  console.error('Swagger export failed:', err?.message || err)
  if (err?.stack) console.error(err.stack)
  process.exit(1)
})
