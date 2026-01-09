#!/usr/bin/env node
/**
 * 简单批量修复TypeScript类型问题
 * 使用正则表达式直接替换文本
 */

import fs from 'node:fs'
import path from 'node:path'
import { glob } from 'glob'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 要修复的目标目录
const targets = [
  'apps/backend/src/modules/advertisement/**/*.ts',
  'apps/backend/src/modules/ai.usecase/**/*.ts',
  'apps/backend/src/modules/debug-trace/**/*.ts',
  'apps/backend/src/modules/payment/**/*.ts',
  'apps/backend/src/modules/preset/**/*.ts',
  'apps/backend/src/modules/invite/**/*.ts',
  'apps/backend/src/modules/email/**/*.ts',
  'apps/backend/src/modules/message-bus/**/*.ts',
  'apps/backend/src/modules/share.story/**/*.ts',
  'apps/backend/src/modules/engagement/**/*.ts',
  'apps/backend/src/modules/file/**/*.ts',
  'apps/sdk/lib/**/*.ts',
  'packages/shared/src/**/*.ts',
]

let fixedAnyCount = 0
let fixedReturnTypeCount = 0
let processedFiles = 0

// 正则替换规则
const replacements = [
  // 1. Record<string, any> → Record<string, unknown>
  {
    pattern: /Record<string, any>/g,
    replacement: 'Record<string, unknown>',
    name: 'Record<string, any>',
  },
  // 2. 函数参数 any
  {
    pattern: /(\w+): any([,)])/g,
    replacement: '$1: unknown$2',
    name: '函数参数 any',
  },
  // 3. 类属性 any
  {
    pattern: /(\w+): any;/g,
    replacement: '$1: unknown;',
    name: '类属性 any',
  },
  // 4. 泛型 any
  {
    pattern: /<any>/g,
    replacement: '<unknown>',
    name: '泛型 <any>',
  },
  // 5. 数组 any[]
  {
    pattern: /: any\[\]/g,
    replacement: ': unknown[]',
    name: '数组 any[]',
  },
]

function processFile(filePath) {
  // 跳过测试文件
  if (filePath.includes('.spec.ts') || filePath.includes('.test.ts')) {
    return
  }

  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false
  let fileFixCount = 0

  // 应用所有替换规则
  replacements.forEach(({ pattern, replacement, name }) => {
    const matches = content.match(pattern)
    if (matches) {
      content = content.replace(pattern, replacement)
      const count = matches.length
      fileFixCount += count
      fixedAnyCount += count
      modified = true
    }
  })

  // 保存修改
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')
    processedFiles++
    console.log(`✅ ${filePath} (修复 ${fileFixCount} 处)`)
  }
}

async function main() {
  console.log('🚀 开始批量修复类型问题...\n')

  for (const target of targets) {
    const files = await glob(target, {
      cwd: path.join(__dirname, '..'),
      absolute: true,
      ignore: ['**/node_modules/**', '**/*.spec.ts', '**/*.test.ts'],
    })

    files.forEach(processFile)
  }

  console.log(`\n✅ 修复完成！`)
  console.log(`  - 处理文件数: ${processedFiles}`)
  console.log(`  - 修复 any 类型: ${fixedAnyCount} 处`)
}

main().catch(console.error)
