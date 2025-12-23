#!/usr/bin/env node

/**
 * 构建后清理脚本
 * 用途：清理静态导出构建产物中的 RSC .txt 文件
 * 原因：Next.js 静态导出会生成 index.txt 等 RSC 数据流文件，
 *       在 S3 静态托管时可能被直接访问，暴露内部数据结构
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 构建产物目录（相对于项目根目录）
const distDir = path.join(__dirname, '../../../dist/front')
const shouldRemoveRscTxt = (process.env.FRONT_REMOVE_RSC_TXT ?? '').toLowerCase() === 'true'

// 确认目标目录指向 dist/front，避免误删其他目录
const normalizedDistDir = path.normalize(distDir)
const parentDirName = path.basename(path.dirname(normalizedDistDir))
const currentDirName = path.basename(normalizedDistDir)

if (parentDirName !== 'dist' || currentDirName !== 'front') {
  console.error('❌ 错误：post-build 清理目标路径异常')
  console.error(`   实际路径: ${normalizedDistDir}`)
  console.error('   期望路径: .../dist/front')
  process.exit(1)
}

if (!shouldRemoveRscTxt) {
  console.log('ℹ️ 跳过 RSC .txt 清理，保留 Next.js 导出的导航数据')
  console.log(
    "   如需删除这些文件，请设置环境变量 FRONT_REMOVE_RSC_TXT='true' 并确保 CDN 已创建访问保护规则",
  )
  process.exit(0)
}

/**
 * 递归删除目录中的 .txt 文件
 * @param {string} dir - 目录路径
 * @returns {number} - 删除的文件数量
 */
function cleanTxtFiles(dir) {
  let count = 0

  if (!fs.existsSync(dir)) {
    console.warn(`⚠️  目录不存在: ${dir}`)
    return count
  }

  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      // 递归处理子目录
      count += cleanTxtFiles(filePath)
    } else if (file.endsWith('.txt')) {
      // 删除 .txt 文件
      try {
        fs.unlinkSync(filePath)
        count++
        console.log(`🗑️  已删除: ${path.relative(distDir, filePath)}`)
      } catch (error) {
        console.warn(`⚠️  删除失败: ${path.relative(distDir, filePath)} - ${error.message}`)
      }
    }
  })

  return count
}

// 主执行逻辑
console.log('🧹 开始清理 RSC .txt 文件...')
console.log(`📂 目标目录: ${distDir}`)

try {
  const deletedCount = cleanTxtFiles(distDir)

  if (deletedCount > 0) {
    console.log(`✅ 清理完成！共删除 ${deletedCount} 个 .txt 文件`)
  } else {
    console.log('✅ 清理完成！未发现需要删除的 .txt 文件')
  }
} catch (error) {
  console.error('❌ 清理失败:', error.message)
  process.exit(1)
}
