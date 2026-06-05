import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const projectRoot = path.resolve(__dirname, '..')
const libRoot = path.join(projectRoot, 'lib')
const jsonObjectImport = "import 'package:built_value/json_object.dart';"

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return walk(full)
    return entry.isFile() && entry.name.endsWith('.dart') ? [full] : []
  })
}

for (const file of walk(libRoot)) {
  const src = fs.readFileSync(file, 'utf8')
  if (!/\bJsonObject\b/.test(src) || src.includes(jsonObjectImport)) continue
  const lines = src.split('\n')
  const builtValueImport = lines.findIndex((line) => line.startsWith("import 'package:built_value/"))
  const firstImport = lines.findIndex((line) => line.startsWith('import '))
  const insertAt = builtValueImport >= 0 ? builtValueImport : firstImport >= 0 ? firstImport : 0
  lines.splice(insertAt, 0, jsonObjectImport)
  fs.writeFileSync(file, lines.join('\n'))
}

const barrel = path.join(libRoot, 'backend_api_contracts.dart')
const dioExport = "export 'package:dio/dio.dart' show Dio, Response, DioException, BaseOptions, Interceptor, InterceptorsWrapper, RequestOptions, CancelToken;"
if (fs.existsSync(barrel)) {
  const src = fs.readFileSync(barrel, 'utf8')
  if (!src.includes(dioExport)) fs.appendFileSync(barrel, `\n// dio type re-export for mobile consumers.\n${dioExport}\n`)
}
