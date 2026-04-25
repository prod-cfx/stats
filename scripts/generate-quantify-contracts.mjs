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

const inputPath = path.join(workspaceRoot, 'dist/openapi/quantify.json')
const outputPath = path.join(workspaceRoot, 'packages/api-contracts/src/generated/quantify.ts')

const openApiDoc = JSON.parse(await fs.readFile(inputPath, 'utf8'))

await generateZodClientFromOpenAPI({
  openApiDoc,
  distPath: outputPath,
  prettierConfig,
  options: {
    withAlias: true,
    baseUrl: '/api/v1',
    apiClientName: 'aiQuantifyClient',
    withDocs: true,
    withDeprecatedEndpoints: true,
    shouldExportAllSchemas: true,
  },
})

let generatedSource = await fs.readFile(outputPath, 'utf8')
generatedSource = generatedSource.replace(/^\/\/ @ts-nocheck\n/, '')
generatedSource = generatedSource.replace(
  'const endpoints: ZodiosEndpointDefinitions = makeApi([',
  'const endpoints = makeApi([',
)
generatedSource = generatedSource.replace(
  "import { makeApi, Zodios, type ZodiosEndpointDefinitions, type ZodiosOptions } from '@zodios/core'\n",
  "import { makeApi, Zodios, type ZodiosOptions } from '@zodios/core'\n",
)
generatedSource = generatedSource.replace(
  'const endpoints = makeApi([',
  "const AccountStrategyDetailTransportEnvelope = z\n  .object({ data: AccountStrategyDetailResponseDto, message: z.string().optional() })\n  .passthrough()\n\nconst endpoints = makeApi([",
)
generatedSource = generatedSource.replaceAll(
  'response: AccountStrategyDetailResponseDto,',
  'response: AccountStrategyDetailTransportEnvelope,',
)
await fs.writeFile(outputPath, generatedSource)

console.log(`Generated quantify contracts: ${path.relative(workspaceRoot, outputPath)}`)
