import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'

const require = createRequire(import.meta.url)
const prettierConfig = require('../prettier.openapi.cjs')

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..')

const inputPath = path.join(workspaceRoot, 'dist/openapi/backend.json')
const outputPath = path.join(workspaceRoot, 'packages/api-contracts/src/generated/backend.ts')

const openApiDoc = JSON.parse(await fs.readFile(inputPath, 'utf8'))

await generateZodClientFromOpenAPI({
  openApiDoc,
  distPath: outputPath,
  prettierConfig,
  options: {
    withAlias: true,
    baseUrl: '/api/v1',
    apiClientName: 'aiBackendClient',
    withDocs: true,
    withDeprecatedEndpoints: true,
    shouldExportAllSchemas: true,
  },
})

console.log(`Generated backend contracts: ${path.relative(workspaceRoot, outputPath)}`)
