export interface InternalKeyLeakGuardFinding {
  key: string
  path: string
  value: string
  suggestion: string
}

export interface InternalKeyLeakGuardScanOptions {
  surface: string
  scanPaths?: boolean
  // 列出"父键名命中后跳过 value-pattern 扫描"的字段名集合。用于 contract 上
  // 内嵌 canonical key 做稳定标识的结构性字段（如前端 React key、displayLogicGraph
  // 块 ID），它们不是用户可见 prose。path/keyPath 扫描（scanPaths）不受影响，
  // 对 prose 字段（label/text/title/question 等）的扫描照常生效。
  //
  // 默认 `[]`（fail-closed）：caller 必须显式声明每个 surface 上允许内嵌 canonical
  // key 的字段，把例外编码在调用点旁边，避免未来新增 surface 隐式继承豁免。
  ignoreValueAtKeys?: readonly string[]
}
