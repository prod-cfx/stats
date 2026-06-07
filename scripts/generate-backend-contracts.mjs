import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { generateZodClientFromOpenAPI } from 'openapi-zod-client'

const require = createRequire(import.meta.url)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const workspaceRoot = path.resolve(__dirname, '..')

const inputPath = path.join(workspaceRoot, 'dist/openapi/backend.json')
const outputPath = path.join(workspaceRoot, 'packages/api-contracts/src/generated/backend.ts')

// openapi-zod-client + tanu 无法可靠生成自引用递归 schema 的 TS 类型，会崩在
// createTypeAliasDeclaration。dart-dio 需要 OpenAPI 输出保留 array-of-$ref 自引用
// （否则 additionalProperties 会被误译成非法 BuiltMap），所以不能改 DTO/源 OpenAPI。
// 这里只在 TS 生成入口把「指向自身的 $ref」降级为 passthrough object，打断递归，
// 不影响 dist/openapi/backend.json 本身（dart 仍读原始递归版本）。
//
// 适用范围：仅覆盖「直接自引用」（schema 内出现指向自身的 $ref，如 children）。
// 相互/间接递归环（A→B→A）当前 backend OpenAPI 不存在，未做 SCC 环检测（YAGNI）；
// 若将来引入相互递归再扩展为基于访问栈的环打断。
//
// 纯函数：原地改写并返回同一 doc；调用方需消费返回值（数据流显式）。
export function breakSelfRecursion(doc) {
  const schemas = doc?.components?.schemas
  if (!schemas) return doc
  for (const [name, schema] of Object.entries(schemas)) {
    const selfRef = `#/components/schemas/${name}`
    const replace = (node) => {
      if (Array.isArray(node)) return node.map(replace)
      if (node && typeof node === 'object') {
        if (node.$ref === selfRef) {
          // 保留 $ref 同级 sibling 字段（如 description/nullable），仅降级 $ref 本身
          const { $ref, ...rest } = node
          return { ...rest, type: 'object', additionalProperties: true }
        }
        for (const key of Object.keys(node)) node[key] = replace(node[key])
      }
      return node
    }
    schemas[name] = replace(schema)
  }
  return doc
}

async function main() {
  const prettierConfig = require('../prettier.openapi.cjs')
  const openApiDoc = JSON.parse(await fs.readFile(inputPath, 'utf8'))
  const normalizedDoc = breakSelfRecursion(openApiDoc)

  await generateZodClientFromOpenAPI({
    openApiDoc: normalizedDoc,
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
}

// 仅在直接运行时执行生成；被测试 import 时只暴露 breakSelfRecursion，不触发副作用。
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
