#!/usr/bin/env node

/**
 * SDK 构建模块
 * 集成原 sdk-release.sh 的功能到 Node.js
 * 支持开发版本和生产版本的构建发布
 */

import { readFileSync, rmSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { logger } from './logger.js'
import { execManager } from './exec.js'
import { confirmManager } from './confirm.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class SDKBuilder {
  constructor() {
    this.scriptsRoot = dirname(__dirname)
    this.projectRoot = dirname(this.scriptsRoot)
    this.sdkRoot = join(this.projectRoot, 'apps/sdk')
    this.backendPid = null
    this.backendStartedByBuilder = false
    this.args = process.argv.slice(2)

    // 版本参数：第一个非标志位参数，默认为 dev
    this.versionArg = this.args.find(arg => !arg.startsWith('-')) || 'dev'

    // 简化模式：SDK 构建统一走“在线生成 OpenAPI”流程，不再区分 online/offline 模式
    this.offline = false
  }

  async build(version = 'dev') {
    try {
      logger.step('SDK 构建开始')

      // 判断是否为开发版本
      const isDevVersion = version === 'dev' || version.includes('dev')
      const isDefaultDevKeyword = version === 'dev'

      // 确定最终版本号
      let finalVersion
      let shouldUpdateVersion = false

      if (isDefaultDevKeyword) {
        // 用户传入默认关键字 'dev'：从 package.json 读取现有版本，不修改
        const packageJson = JSON.parse(readFileSync(join(this.sdkRoot, 'package.json'), 'utf8'))
        finalVersion = packageJson.version
        shouldUpdateVersion = false
        logger.info(`使用 package.json 现有版本: ${finalVersion}`)
      } else {
        // 用户显式指定版本号（包括自定义 dev 版本如 1.2.3-dev）：使用该版本并更新
        finalVersion = version
        shouldUpdateVersion = true
      }

      // 开发版本警告
      if (isDevVersion) {
        logger.warn('⚠️  开发版本构建：此版本仅用于本地/CI 验证，禁止发布到 npm！')
      }

      if (!isDevVersion) {
        const confirmed = await confirmManager.confirmRelease(finalVersion, true)
        if (!confirmed) {
          logger.info('SDK 发布已取消')
          return
        }
      }

      // 步骤 1: OpenAPI 准备（统一走在线链路）
      logger.info('SDK 构建将通过 backend export:openapi 自动生成 OpenAPI 规范，无需手动启动后端服务')

      // 步骤 4: 构建 SDK
      await this.buildSDK(finalVersion, shouldUpdateVersion)

      // 步骤 5: 运行测试（如果需要）
      if (!isDevVersion) {
        await this.runTests()
      }

      // 步骤 6: 打包
      await this.packageSDK()

      logger.success(`🎉 SDK 构建完成! 版本: ${finalVersion}`)

      if (!isDevVersion) {
        this.showReleaseInstructions(finalVersion)
      }
    } catch (error) {
      logger.error('SDK 构建失败')
      logger.error(error.message)
      throw error
    } finally {
      await this.cleanup()
    }
  }

  // 检查后端健康
  async isBackendHealthy() {
    try {
      await execManager.executeCommand('curl -sf http://localhost:3000/api/v1/health')
      return true
    } catch {
      return false
    }
  }

  // 检查和清理端口
  async checkAndCleanPort(port) {
    logger.step(`检查并清理端口 ${port}`)

    try {
      const processes = await execManager.getPortProcesses(port)
      if (processes.length > 0) {
        logger.warn(`端口 ${port} 被占用，将自动清理: ${processes.join(', ')}`)
        await execManager.killPortProcesses(port)
        logger.success(`端口 ${port} 已清理`)

        // 等待端口释放
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        logger.success(`端口 ${port} 未被占用`)
      }
    } catch (error) {
      if (error.message.includes('lsof')) {
        logger.warn('无法检查端口占用情况，将尝试直接启动服务')
      } else {
        throw error
      }
    }
  }

  // 启动后端服务
  async startBackendService() {
    logger.step('启动后端服务')

    // 使用项目根目录的 pnpm 脚本启动后端
    // 遵循统一命令策略：本地通过 ./scripts/dx 启动后端
    const command = './scripts/dx start backend --dev'

    logger.info(`启动命令: ${command}`)
    logger.info('后端服务将在后台运行...')

    // 异步启动后端服务（不阻塞）
    execManager
      .spawnCommand(command, {
        cwd: this.projectRoot,
        stdio: 'ignore', // 忽略子进程输出，避免管道阻塞导致卡住
        detached: false,
      })
      .catch(() => {
        // 静默处理后端进程错误，因为我们会在后面检查端口是否就绪
      })

    logger.info('后端进程已启动（后台）')
  }

  // 等待后端就绪
  async waitForBackend() {
    logger.step('等待后端服务启动')

    const maxWait = 60000 // 60秒
    const interval = 2000 // 2秒
    const maxAttempts = Math.floor(maxWait / interval)
    let attempt = 0

    logger.progress('检查后端服务状态')

    while (attempt < maxAttempts) {
      try {
        // 检查带有全局前缀的健康检查端点
        await execManager.executeCommand('curl -sf http://localhost:3000/api/v1/health')
        logger.progressDone()
        logger.success('后端服务已启动成功!')
        return
      } catch (error) {
        attempt++
        if (attempt < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, interval))
          process.stdout.write('.')
        }
      }
    }

    logger.progressDone()
    throw new Error(`后端服务启动超时 (>${maxWait / 1000}s)`)
  }

  // 构建 SDK
  async buildSDK(version, shouldUpdateVersion = false) {
    logger.step(`构建 SDK 版本 ${version}`)

    // 切换到 SDK 目录
    process.chdir(this.sdkRoot)
    logger.info(`工作目录: ${this.sdkRoot}`)

    // 清理旧的构建文件
    await this.cleanOldFiles()

    // 根据 shouldUpdateVersion 决定是否更新版本号
    if (shouldUpdateVersion) {
      await this.updateVersion(version)
    } else {
      logger.info('使用现有版本号，跳过 package.json 修改')
    }

    // 生成 OpenAPI SDK
    await this.generateOpenAPISDK()

    // 安装依赖
    await this.installDependencies()

    // 检查 webpack-cli
    await this.checkWebpackCli()

    // 构建项目
    await this.buildProject()
  }

  // 清理旧文件
  async cleanOldFiles() {
    logger.info('清理旧的构建文件和SDK包')

    try {
      // 运行 pnpm clean
      await execManager.executeCommand('pnpm clean', { cwd: this.sdkRoot })

      // 清理包文件
      await execManager.executeCommand('rm -f *.tgz', { cwd: this.sdkRoot })

      // 清理生成文件
      const cleanPaths = ['src/generated', 'openapi/generated', 'dist']
      for (const path of cleanPaths) {
        try {
          rmSync(join(this.sdkRoot, path), { recursive: true, force: true })
        } catch (error) {
          // 忽略不存在的路径
        }
      }

      logger.success('清理完成')
    } catch (error) {
      logger.warn(`清理时出现警告: ${error.message}`)
    }
  }

  // 更新版本号
  async updateVersion(version) {
    logger.info(`更新版本号到 ${version}`)

    await execManager.executeCommand(`pnpm pkg set version=${version}`, {
      cwd: this.sdkRoot,
    })

    logger.success('版本号更新成功')
  }

  // 生成 OpenAPI SDK
  async generateOpenAPISDK() {
    logger.info('生成 OpenAPI SDK')

    // 统一使用在线生成流程；如需自定义/离线行为，可直接调用 apps/sdk/scripts/regen_openapi.sh
    const cmd = 'pnpm generate'
    const extraEnv = { SDK_USE_BACKEND_EXPORT: '1' }
    await execManager.executeCommand(cmd, {
      cwd: this.sdkRoot,
      env: extraEnv,
    })

    logger.success(`SDK 生成成功（${this.offline ? '离线' : '在线'}）`)
  }

  // 安装依赖
  async installDependencies() {
    logger.info('安装所有依赖')

    await execManager.executeCommand('pnpm install', {
      cwd: this.sdkRoot,
    })

    logger.success('依赖安装成功')
  }

  // 检查 webpack-cli
  async checkWebpackCli() {
    logger.info('检查 webpack-cli')

    try {
      await execManager.executeCommand('pnpm ls webpack-cli', {
        cwd: this.sdkRoot,
      })
      logger.success('webpack-cli 已安装')
    } catch (error) {
      throw new Error('未找到 webpack-cli，请先安装: pnpm add -D webpack-cli')
    }
  }

  // 构建项目
  async buildProject() {
    logger.info('构建项目')

    await execManager.executeCommand('pnpm build', {
      cwd: this.sdkRoot,
    })

    logger.success('构建成功')
  }

  // 运行测试
  async runTests() {
    logger.step('运行 Demo 测试')

    try {
      await execManager.executeCommand('pnpm demo', {
        cwd: this.sdkRoot,
      })
      logger.success('Demo 测试通过')
    } catch (error) {
      logger.warn('Demo 测试失败，但将继续构建流程')
      logger.warn('您可以在构建完成后手动运行测试')
    }
  }

  // 打包 SDK
  async packageSDK() {
    logger.step('打包项目')

    await execManager.executeCommand('pnpm pack', {
      cwd: this.sdkRoot,
    })

    // 获取包信息
    const packageJson = JSON.parse(readFileSync(join(this.sdkRoot, 'package.json'), 'utf8'))
    const packageFile = `${packageJson.name}-${packageJson.version}.tgz`

    logger.success(`打包完成: ${packageFile}`)
  }

  // 显示发布说明
  showReleaseInstructions(version) {
    logger.separator()
    logger.success('🎉 SDK 构建和打包完成!')
    logger.info(`📦 包文件: ${this.getExpectedPackageFile(version)}`)

    if (!version.includes('dev')) {
      logger.info('\n下一步操作:')
      logger.info(`1. 检查包文件是否正确`)
      logger.info(`2. 发布到 npm: npm publish ${this.getExpectedPackageFile(version)}`)
      logger.info(`3. 创建 Git 标签: git tag -a 'v${version}' -m 'version ${version}'`)
      logger.info(`4. 推送标签: git push origin 'v${version}'`)
    }
  }

  // 获取预期的包文件名
  getExpectedPackageFile(version) {
    try {
      const packageJson = JSON.parse(readFileSync(join(this.sdkRoot, 'package.json'), 'utf8'))
      return `${packageJson.name}-${version}.tgz`
    } catch (error) {
      return `ai-sdk-${version}.tgz`
    }
  }

  // 清理资源
  async cleanup() {
    logger.info('清理资源...')

    // 只清理由构建器启动的后端服务
    if (this.backendStartedByBuilder && !this.offline) {
      try {
        // 直接杀掉端口进程，不等待优雅退出
        await execManager.killPortProcesses(3000)
        logger.success('后端服务已清理')
      } catch (error) {
        logger.debug(`清理后端服务时出错: ${error.message}`)
      }
    }

    // 快速清理所有运行中的进程，不等待
    try {
      const processCount = execManager.runningProcesses.size
      if (processCount > 0) {
        logger.debug(`快速清理 ${processCount} 个进程...`)
        for (const [, { process }] of execManager.runningProcesses) {
          try {
            process.kill('SIGKILL') // 直接强制杀掉，不等待
          } catch {}
        }
        execManager.runningProcesses.clear()
      }
    } catch (error) {
      logger.debug(`快速清理进程时出错: ${error.message}`)
    }

    // 切换回项目根目录
    process.chdir(this.projectRoot)
  }
}

// 如果直接执行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
  const builder = new SDKBuilder()

  builder.build(builder.versionArg).catch(error => {
    logger.error('SDK 构建失败')
    console.error(error)
    process.exit(1)
  })
}

export { SDKBuilder }
