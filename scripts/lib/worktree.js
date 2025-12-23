#!/usr/bin/env node

import path from 'node:path'
import fs from 'node:fs'
import { execSync } from 'node:child_process'
import { logger } from './logger.js'
import { confirmManager } from './confirm.js'
//

const MANUAL_SETUP_STEPS = [
  { description: '安装依赖', command: 'pnpm install' },
  { description: '构建后端', command: './scripts/dx build backend --dev' },
  { description: '构建用户前端', command: './scripts/dx build front --dev' },
  { description: '构建管理后台', command: './scripts/dx build admin --dev' },
]

class WorktreeManager {
  constructor() {
    this.repoRoot = process.cwd()
    this.baseDir = path.resolve(this.repoRoot, '..')
    this.prefix = 'ai_monorepo_issue_'
  }

  // 获取 worktree 路径
  getWorktreePath(issueNumber) {
    return path.join(this.baseDir, `${this.prefix}${issueNumber}`)
  }

  // 创建 worktree
  async make(issueNumber, options = {}) {
    const worktreePath = this.getWorktreePath(issueNumber)
    const branchName = `issue-${issueNumber}`
    const baseBranch = (options.baseBranch || 'main').trim()

    logger.info(`\n${'='.repeat(50)}`)
    logger.info(`🔧 创建 Worktree: ${branchName}`)
    logger.info(`基础分支: ${baseBranch}`)
    logger.info('='.repeat(50))

    // 检查目标目录是否存在
    if (fs.existsSync(worktreePath)) {
      logger.error(`Worktree 目录已存在: ${worktreePath}`)
      logger.info('提示: 如需重建，请先删除现有 worktree')
      return false
    }

    try {
      // 获取当前分支
      const currentBranch = execSync('git branch --show-current').toString().trim()
      logger.info(`当前分支: ${currentBranch}`)

      // 确保基础分支是最新的
      logger.step(`更新 ${baseBranch} 分支...`)
      try {
        if (currentBranch === baseBranch) {
          execSync(`git pull origin ${baseBranch}`, { stdio: 'inherit' })
        } else {
          execSync(`git fetch origin ${baseBranch}:${baseBranch}`, { stdio: 'inherit' })
        }
      } catch (e) {
        logger.warn(`更新 ${baseBranch} 分支失败，尝试兜底同步`)
        try {
          execSync('git fetch --all --prune', { stdio: 'inherit' })
          try {
            execSync(`git show-ref --verify --quiet refs/heads/${baseBranch}`)
          } catch (_) {
            execSync(`git branch ${baseBranch} origin/${baseBranch}`, { stdio: 'inherit' })
          }
          execSync(`git branch -f ${baseBranch} origin/${baseBranch}`, { stdio: 'inherit' })
        } catch (e2) {
          logger.error(`无法更新基础分支 ${baseBranch}: ${e2.message}`)
          throw e2
        }
      }

      // 创建 worktree
      logger.step(`创建 worktree 到 ${worktreePath}`)

      // 检查分支是否已存在
      let branchExists = false
      try {
        execSync(`git show-ref --verify --quiet refs/heads/${branchName}`)
        branchExists = true
        logger.info(`分支 ${branchName} 已存在，将使用现有分支`)
      } catch (e) {
        // 分支不存在，这是正常的
      }

      if (branchExists) {
        // 使用现有分支
        execSync(`git worktree add "${worktreePath}" ${branchName}`, { stdio: 'inherit' })
      } else {
        // 从基础分支创建新分支
        execSync(`git worktree add -b ${branchName} "${worktreePath}" ${baseBranch}`, {
          stdio: 'inherit',
        })
      }

      logger.success(`✅ Worktree 创建成功: ${worktreePath}`)

      // 复制环境变量文件
      logger.step('复制环境变量文件到新 worktree...')
      await this.copyEnvFiles(worktreePath)

      // 提示后续需要手动安装依赖
      this.printManualSetupInstructions(worktreePath)

      // 提供快速切换命令
      logger.info('\n快速切换到新 worktree:')
      logger.info(`  $ cd ${worktreePath}`)

      return true
    } catch (error) {
      logger.error(`创建 worktree 失败: ${error.message}`)
      return false
    }
  }

  // 复制环境变量文件
  async copyEnvFiles(worktreePath) {
    const sourceRoot = this.repoRoot

    // 定义需要复制的环境变量文件
    const envFiles = [
      '.env.development.local',
      '.env.production.local',
      '.env.test.local',
      '.env.e2e.local',
      'apps/backend/.env.e2e.local',
    ]

    let copiedCount = 0
    let skippedCount = 0

    for (const envFile of envFiles) {
      const sourcePath = path.join(sourceRoot, envFile)
      const targetPath = path.join(worktreePath, envFile)

      try {
        // 检查源文件是否存在
        if (fs.existsSync(sourcePath)) {
          // 确保目标目录存在
          const targetDir = path.dirname(targetPath)
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true })
          }

          // 复制文件
          fs.copyFileSync(sourcePath, targetPath)
          logger.info(`  ✅ 复制: ${envFile}`)
          copiedCount++
        } else {
          logger.info(`  ⚠️  跳过: ${envFile} (源文件不存在)`)
          skippedCount++
        }
      } catch (error) {
        logger.error(`  ❌ 复制失败: ${envFile} - ${error.message}`)
        skippedCount++
      }
    }

    if (copiedCount > 0) {
      logger.success(`✅ 环境变量文件复制完成: ${copiedCount} 个文件已复制`)
    }
    if (skippedCount > 0) {
      logger.info(`📝 跳过 ${skippedCount} 个文件`)
    }
  }

  printManualSetupInstructions(worktreePath) {
    logger.info('\n📋 手动初始化步骤')
    logger.info('该命令不再自动软链接 node_modules 或复制任何构建产物。')
    logger.info('请进入新 worktree 后按需执行以下操作:')
    logger.info(`  $ cd ${worktreePath}`)
    MANUAL_SETUP_STEPS.forEach(step => {
      logger.info(`  $ ${step.command}  —— ${step.description}`)
    })
    logger.info('根据需求运行 ./scripts/dx start|build|test 等命令完成后续工作。')
  }

  // 删除 worktree（支持批量删除）
  async del(issueNumbers, options = {}) {
    // 兼容单个 issue 编号的旧接口
    if (typeof issueNumbers === 'string' || typeof issueNumbers === 'number') {
      issueNumbers = [issueNumbers]
    }

    if (!Array.isArray(issueNumbers) || issueNumbers.length === 0) {
      logger.error('请提供有效的 issue 编号')
      return false
    }

    const totalCount = issueNumbers.length
    const isBatch = totalCount > 1

    logger.info(`\n${'='.repeat(60)}`)
    if (isBatch) {
      logger.info(`🗑️  批量删除 Worktree: ${totalCount} 个`)
      logger.info(`Issue 编号: ${issueNumbers.join(', ')}`)
    } else {
      logger.info(`🗑️  删除 Worktree: issue-${issueNumbers[0]}`)
    }
    logger.info('='.repeat(60))

    let successCount = 0
    let failedCount = 0
    const results = []

    for (let i = 0; i < issueNumbers.length; i++) {
      const issueNumber = issueNumbers[i]
      const isLast = i === issueNumbers.length - 1

      if (isBatch) {
        logger.info(`\n[${i + 1}/${totalCount}] 处理 issue-${issueNumber}...`)
      }

      const result = await this.delSingle(issueNumber, options, isBatch, isLast)
      results.push({ issueNumber, success: result })

      if (result) {
        successCount++
      } else {
        failedCount++
      }

      // 批量模式下，在每个删除操作之间添加短暂延迟
      if (isBatch && !isLast) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    // 显示批量操作总结
    if (isBatch) {
      logger.info(`\n${'='.repeat(60)}`)
      logger.info('📊 批量删除总结')
      logger.info('='.repeat(60))
      logger.info(`总计: ${totalCount} 个 worktree`)
      logger.info(`成功: ${successCount} 个`)
      if (failedCount > 0) {
        logger.info(`失败: ${failedCount} 个`)

        const failedIssues = results.filter(r => !r.success).map(r => r.issueNumber)
        logger.warn(`失败的 issue: ${failedIssues.join(', ')}`)
      }

      if (successCount === totalCount) {
        logger.success('✅ 所有 worktree 删除成功')
      } else if (successCount > 0) {
        logger.warn('⚠️  部分 worktree 删除成功')
      } else {
        logger.error('❌ 所有 worktree 删除失败')
      }
    }

    return successCount === totalCount
  }

  // 删除单个 worktree 的内部方法
  async delSingle(issueNumber, options = {}, isBatch = false, isLast = false) {
    const worktreePath = this.getWorktreePath(issueNumber)
    const branchName = `issue-${issueNumber}`

    if (!isBatch) {
      logger.info(`\n${'='.repeat(50)}`)
      logger.info(`🗑️  删除 Worktree: ${branchName}`)
      logger.info('='.repeat(50))
    }

    // 检查 worktree 是否存在
    if (!fs.existsSync(worktreePath)) {
      const message = `Worktree 不存在: ${worktreePath}`
      if (isBatch) {
        logger.warn(`⚠️  ${message}`)
      } else {
        logger.error(message)
      }
      return false
    }

    try {
      // 检查是否有未提交的更改
      const originalCwd = process.cwd()
      process.chdir(worktreePath)

      let hasUncommittedChanges = false
      let hasUnpushedCommits = false

      try {
        // 检查未提交的更改（静默错误输出，避免噪声）
        const gitStatus = execSync('git status --porcelain 2>/dev/null').toString()
        if (gitStatus.trim()) {
          hasUncommittedChanges = true
          if (!isBatch || !options.force) {
            logger.warn('⚠️  检测到未提交的更改:')
            console.log(gitStatus)
          }
        }

        // 检查未推送的提交
        const unpushed = execSync(
          `git log origin/${branchName}..${branchName} --oneline 2>/dev/null || git log origin/main..${branchName} --oneline`,
        ).toString()
        if (unpushed.trim()) {
          hasUnpushedCommits = true
          if (!isBatch || !options.force) {
            logger.warn('⚠️  检测到未推送的提交:')
            console.log(unpushed)
          }
        }
      } catch (error) {
        // 可能是新分支还没有推送到远程
        if (!isBatch || !options.force) {
          logger.info('提示: 无法检查远程状态，可能是新分支')
        }
      }

      process.chdir(originalCwd)

      // 如果有未提交或未推送的更改，询问用户（除非是强制模式）
      if ((hasUncommittedChanges || hasUnpushedCommits) && !options.force) {
        logger.warn('\n⚠️  警告: 检测到未保存的工作')
        if (hasUncommittedChanges) {
          logger.warn('  - 有未提交的更改')
        }
        if (hasUnpushedCommits) {
          logger.warn('  - 有未推送的提交')
        }

        const confirmMessage = isBatch
          ? `\n是否强制删除 issue-${issueNumber}？(这将丢失所有未保存的工作)`
          : '\n是否强制删除？(这将丢失所有未保存的工作)'

        const forceDelete = await confirmManager.confirm(confirmMessage)

        if (!forceDelete) {
          if (isBatch) {
            logger.warn(`⚠️  跳过 issue-${issueNumber}`)
          } else {
            logger.info('已取消删除操作')
            logger.info('\n建议操作:')
            if (hasUncommittedChanges) {
              logger.info('  $ git add . && git commit -m "Save work"')
            }
            if (hasUnpushedCommits) {
              logger.info(`  $ git push origin ${branchName}`)
            }
          }
          return false
        }
      }

      // 删除 worktree
      if (isBatch) {
        logger.step(`删除 worktree: ${branchName}`)
      } else {
        logger.step('删除 worktree...')
      }
      try {
        // 使用 pipe 捕获错误信息，便于识别损坏场景并做降级处理
        execSync(`git worktree remove "${worktreePath}" --force`)
      } catch (err) {
        const msg = `${String(err?.message || '')}\n${String(err?.stderr || '')}\n${String(
          err?.stdout || '',
        )}`
        // 当 worktree 的 .git 指针损坏或主仓库路径变更时，git 无法移除，降级为物理删除
        const suspectedBroken = /not a \.git file|not a git repository|validation failed/i.test(msg)
        if (suspectedBroken) {
          const prompt = `检测到损坏的 worktree（可能更换过主仓库路径）。是否直接删除目录 ${worktreePath} ？(不可恢复)`
          let doFsRemove = !!options.force
          if (!doFsRemove) {
            doFsRemove = await confirmManager.confirm(prompt)
          }
          if (!doFsRemove) {
            return false
          }
          try {
            // 优先使用 Node API 删除，失败再回退到 shell rm -rf
            fs.rmSync(worktreePath, { recursive: true, force: true })
            logger.info(`已物理删除目录: ${worktreePath}`)
          } catch (rmErr) {
            try {
              execSync(`rm -rf "${worktreePath}"`)
              logger.info(`已物理删除目录(回退): ${worktreePath}`)
            } catch (rmErr2) {
              logger.error(`物理删除目录失败: ${rmErr2.message}`)
              return false
            }
          }
        } else {
          // 其他错误直接抛出
          throw err
        }
      }

      // 询问是否删除分支（批量模式下根据 force 选项决定）
      let deleteBranch = false
      if (options.force) {
        // 非交互模式：默认删除分支
        deleteBranch = true
      } else {
        const confirmMessage = isBatch
          ? `是否同时删除本地分支 ${branchName}？`
          : `是否同时删除本地分支 ${branchName}？`
        deleteBranch = await confirmManager.confirm(confirmMessage)
      }

      if (deleteBranch) {
        try {
          execSync(`git branch -D ${branchName}`, { stdio: 'inherit' })
          if (isBatch) {
            logger.info(`✅ 分支 ${branchName} 已删除`)
          } else {
            logger.success(`✅ 分支 ${branchName} 已删除`)
          }
        } catch (error) {
          const emsg = String(error?.message || '')
          logger.warn(`无法删除分支: ${error.message}`)
          // 若提示分支在某 worktree 已检出，先 prune 再重试一次
          if (/checked out at/i.test(emsg)) {
            try {
              execSync('git worktree prune -v', { stdio: 'inherit' })
              execSync(`git branch -D ${branchName}`, { stdio: 'inherit' })
              logger.info(`✅ 分支 ${branchName} 已删除(二次尝试) `)
            } catch (_) {
              // 忽略重试失败
            }
          }
        }
      }

      // 清理 worktree 列表（只在最后一个或单个删除时执行）
      if (!isBatch || isLast) {
        logger.step('清理 worktree 列表...')
        try {
          execSync('git worktree prune', { stdio: 'inherit' })
        } catch (_) {
          // 忽略 prune 错误（在损坏场景下可能无记录）
        }
      }

      if (isBatch) {
        logger.success(`✅ issue-${issueNumber} 删除成功`)
      } else {
        logger.success(`✅ Worktree 删除成功: ${worktreePath}`)
      }
      return true
    } catch (error) {
      const message = `删除 worktree 失败: ${error.message}`
      if (isBatch) {
        logger.error(`❌ issue-${issueNumber}: ${message}`)
      } else {
        logger.error(message)
      }
      return false
    }
  }

  // 列出所有 worktree
  async list() {
    logger.info(`\n${'='.repeat(50)}`)
    logger.info('📋 Worktree 列表')
    logger.info('='.repeat(50))

    try {
      // 获取 git worktree 列表
      const worktreeList = execSync('git worktree list --porcelain').toString()
      const worktrees = this.parseWorktreeList(worktreeList)

      // 过滤出 issue 相关的 worktree
      const issueWorktrees = worktrees.filter(wt => {
        return wt.path.includes(this.prefix)
      })

      if (issueWorktrees.length === 0) {
        logger.info('没有找到 issue 相关的 worktree')
        logger.info(`\n提示: 使用 'dx worktree make <issue_number>' 创建新的 worktree`)
        return
      }

      // 显示列表
      console.log('\n📁 Issue Worktrees:\n')
      console.log('编号\t分支\t\t路径\t\t\t状态')
      console.log('----\t----\t\t----\t\t\t----')

      for (const wt of issueWorktrees) {
        // 提取 issue 编号
        const match = wt.path.match(/ai_monorepo_issue_(\d+)/)
        const issueNum = match ? match[1] : '?'

        // 检查状态
        let status = '正常'
        if (wt.locked) {
          status = '锁定'
        } else if (wt.prunable) {
          status = '可清理'
        }

        // 尝试快速检测 .git 指针是否损坏，避免噪声
        try {
          const dotgitPath = path.join(wt.path, '.git')
          let broken = false
          if (fs.existsSync(dotgitPath)) {
            const stat = fs.lstatSync(dotgitPath)
            if (stat.isFile()) {
              const content = fs.readFileSync(dotgitPath, 'utf8')
              const m = content.match(/gitdir:\s*(.*)/i)
              if (m && m[1]) {
                const target = m[1].trim()
                // 相对路径转绝对
                const abs = path.isAbsolute(target) ? target : path.resolve(wt.path, target)
                if (!fs.existsSync(abs)) broken = true
              }
            }
          } else {
            broken = true
          }

          if (broken) {
            status = '无法访问'
          } else {
            // 检查是否有未提交的更改（静默错误输出）
            const originalCwd = process.cwd()
            process.chdir(wt.path)
            const gitStatus = execSync('git status --porcelain 2>/dev/null').toString()
            if (gitStatus.trim()) {
              status += ' (有更改)'
            }
            process.chdir(originalCwd)
          }
        } catch (e) {
          status = '无法访问'
        }

        console.log(`#${issueNum}\t${wt.branch || 'detached'}\t${wt.path}\t${status}`)
      }

      // 显示统计
      console.log(`\n总计: ${issueWorktrees.length} 个 worktree`)

      // 显示可用命令
      console.log('\n可用命令:')
      console.log('  dx worktree make <number>  - 创建新的 worktree')
      console.log('  dx worktree del <number>   - 删除 worktree')
      console.log('  dx worktree clean          - 清理无效的 worktree')
    } catch (error) {
      logger.error(`获取 worktree 列表失败: ${error.message}`)
      logger.info('提示: 确保在 git 仓库中运行此命令')
    }
  }

  // 解析 worktree 列表
  parseWorktreeList(output) {
    const worktrees = []
    const lines = output.split('\n')
    let current = {}

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        if (current.path) {
          worktrees.push(current)
        }
        current = { path: line.substring(9) }
      } else if (line.startsWith('HEAD ')) {
        current.head = line.substring(5)
      } else if (line.startsWith('branch ')) {
        current.branch = line.substring(7)
      } else if (line.startsWith('locked')) {
        current.locked = true
      } else if (line.startsWith('prunable')) {
        current.prunable = true
      } else if (line === '') {
        if (current.path) {
          worktrees.push(current)
          current = {}
        }
      }
    }

    if (current.path) {
      worktrees.push(current)
    }

    return worktrees
  }

  // 获取所有 issue 相关的 worktree 编号
  async getAllIssueWorktrees() {
    try {
      // 获取 git worktree 列表
      const worktreeList = execSync('git worktree list --porcelain').toString()
      const worktrees = this.parseWorktreeList(worktreeList)

      // 过滤出 issue 相关的 worktree 并提取编号
      const issueNumbers = []
      for (const wt of worktrees) {
        // 优先基于分支名识别 issue（更可靠）
        if (wt.branch) {
          // 匹配 refs/heads/issue-<num> 格式
          const branchMatch = wt.branch.match(/^refs\/heads\/issue-(\d+)$/)
          if (branchMatch && branchMatch[1]) {
            issueNumbers.push(branchMatch[1])
            continue
          }
        }

        // 兜底：基于路径识别（使用更严格的正则）
        const pathMatch = path.basename(wt.path).match(/^ai_monorepo_issue_(\d+)$/)
        if (pathMatch && pathMatch[1]) {
          issueNumbers.push(pathMatch[1])
        }
      }

      return issueNumbers
    } catch (error) {
      logger.error(`获取 worktree 列表失败: ${error.message}`)
      return []
    }
  }

  // 清理无效的 worktree
  async clean() {
    logger.info(`\n${'='.repeat(50)}`)
    logger.info('🧹 清理无效的 Worktree')
    logger.info('='.repeat(50))

    try {
      logger.step('检查并清理无效的 worktree...')
      const output = execSync('git worktree prune -v').toString()

      if (output.trim()) {
        console.log(output)
        logger.success('✅ 清理完成')
      } else {
        logger.info('没有需要清理的 worktree')
      }

      // 列出剩余的 worktree
      await this.list()
    } catch (error) {
      logger.error(`清理失败: ${error.message}`)
    }
  }
}

export default new WorktreeManager()
