/**
 * DX CLI 主入口脚本（本地开发专用）
 * 提供统一的命令行接口来管理开发环境。
 * 说明：CI/CD 与本地统一使用 `./scripts/dx` 命令系统（见 docs/CI_SCRIPTS_MIGRATION.md）。
 *
 * 用法:
 *   dx start [service] [环境标志]  - 启动/桥接服务（环境标志需带 -- 前缀）
 *   dx build [target] [环境标志]   - 构建应用（环境标志需使用 --dev/--staging/--prod/--test/--e2e）
 *   dx deploy [环境标志]           - 应用数据库迁移（prisma migrate deploy）
 *   dx contracts [generate]        - 生成 API 合约（OpenAPI -> Zod）
 *   dx db [action] [环境标志]      - 数据库操作（默认 --dev，亦可传入其他环境标志）
 *   dx test [type]                 - 运行测试
 *   dx lint                        - 代码检查
 *   dx clean [target]              - 清理操作
 *
 * 全局选项:
 *   --dev, --development      - 强制使用开发环境
 *   --prod, --production      - 强制使用生产环境
 *   --staging, --stage        - 强制使用预发环境
 *   --test                    - 强制使用测试环境
 *   --e2e                     - 强制使用E2E测试环境
 *   -Y, --yes                 - 跳过所有确认提示
 *   -v, --verbose             - 详细输出
 *   -h, --help                - 显示帮助信息
 */

import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { logger } from '../logger.js'
import { envManager } from '../env.js'
import { execManager } from '../exec.js'
import { validateEnvironment } from '../validate-env.js'
import { FLAG_DEFINITIONS, parseFlags } from './flags.js'
import { getCleanArgs } from './args.js'
import { showHelp, showCommandHelp } from './help.js'
import {
  handleHelp,
  handleDev,
  handleBuild,
  handleTest,
  handleLint,
  handleClean,
  handleCache,
  handleInstall,
  handleStatus,
} from './commands/core.js'
import { handleStart } from './commands/start.js'
import { handleDeploy } from './commands/deploy.js'
import { handleDatabase } from './commands/db.js'
import { handleWorktree } from './commands/worktree.js'
import { handlePackage } from './commands/package.js'
import { handleExport } from './commands/export.js'
import { handleContracts } from './commands/contracts.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

class DxCli {
  constructor() {
    this.commands = this.loadCommands()
    this.args = process.argv.slice(2)
    this.flags = parseFlags(this.args)
    this.command = this.args[0]
    this.subcommand = this.args[1]
    this.environment = this.args[2]
    this.worktreeManager = null
    this.envCache = null // 缓存已验证的环境变量，避免重复解析
    this.commandHandlers = {
      help: args => handleHelp(this, args),
      dev: args => handleDev(this, args),
      start: args => handleStart(this, args),
      build: args => handleBuild(this, args),
      test: args => handleTest(this, args),
      lint: args => handleLint(this, args),
      clean: args => handleClean(this, args),
      cache: args => handleCache(this, args),
      install: args => handleInstall(this, args),
      status: args => handleStatus(this, args),
      deploy: args => handleDeploy(this, args),
      db: args => handleDatabase(this, args),
      worktree: args => handleWorktree(this, args),
      package: args => handlePackage(this, args),
      export: args => handleExport(this, args),
      contracts: args => handleContracts(this, args),
    }

    this.flagDefinitions = FLAG_DEFINITIONS
  }

  // 加载命令配置
  loadCommands() {
    try {
      const configPath = join(__dirname, '../../config/commands.json')
      return JSON.parse(readFileSync(configPath, 'utf8'))
    } catch (error) {
      logger.error('无法加载命令配置文件')
      logger.error(error.message)
      process.exit(1)
    }
  }

  // 检测并安装依赖
  async ensureDependencies() {
    if (this.flags.help || !this.command || this.command === 'help') return

    const nodeModulesPath = join(process.cwd(), 'node_modules')

    // 检查 node_modules 是否存在且包含关键依赖
    if (!existsSync(nodeModulesPath) || !existsSync(join(nodeModulesPath, '.pnpm'))) {
      logger.warn('检测到依赖未安装，正在自动安装...')
      logger.info('将以 NODE_ENV=development 安装完整依赖（含 devDependencies）')
      try {
        execSync('pnpm install --frozen-lockfile', {
          stdio: 'inherit',
          cwd: process.cwd(),
          env: {
            ...process.env,
            NODE_ENV: 'development', // 确保安装完整依赖（含 devDependencies）
          },
        })
        logger.success('依赖安装完成')
      } catch (error) {
        logger.error('依赖安装失败，请手动执行: pnpm install')
        process.exit(1)
      }
    }
  }

  // 每次启动时执行的检查流程
  async runStartupChecks() {
    if (this.flags.help || !this.command || this.command === 'help') return

    // 1. 在 worktree 中自动同步根目录的 .env.*.local 文件
    try {
      const worktreeManager = await this.getWorktreeManager()
      worktreeManager.syncEnvFilesFromMainRoot()
    } catch (error) {
      logger.warn(`自动同步 env 文件失败: ${error.message}`)
    }

    // 跳过 db 命令本身的启动检查（避免递归）
    if (this.command === 'db') return

    // 2. 检测 Prisma Client 是否存在，不存在则执行 db generate
    await this.ensurePrismaClient()

    // 3. 验证环境变量（仅对需要验证的命令执行）
    // 注意：某些命令（如 lint）配置了 skipEnvValidation: true，不需要验证
    const commandConfig = this.getCommandConfig(this.command)
    if (!commandConfig?.skipEnvValidation) {
      await this.validateEnvVars()
    }
  }

  // 获取命令配置
  getCommandConfig(command) {
    return this.commands[command]
  }

  // 检测并生成 Prisma Client
  async ensurePrismaClient() {
    // pnpm 结构下检测 @prisma/client 生成的 default.js 文件
    const prismaClientPath = join(process.cwd(), 'node_modules', '@prisma', 'client', 'default.js')

    if (!existsSync(prismaClientPath)) {
      const environment = this.determineEnvironment()
      const envFlag = this.getEnvironmentFlag(environment)

      logger.step('检测到 Prisma Client 未生成，正在生成...')
      try {
        execSync(`./scripts/dx db generate ${envFlag}`, {
          stdio: 'inherit',
          cwd: process.cwd(),
        })
        logger.success('Prisma Client 生成完成')
      } catch (error) {
        logger.error('Prisma Client 生成失败')
        logger.error(error.message)
        process.exit(1)
      }
    }
  }

  // 验证环境变量（与 build 命令一致的检测逻辑）
  async validateEnvVars() {
    const environment = this.determineEnvironment()

    // 如果已缓存且环境相同，跳过重复验证
    if (this.envCache?.environment === environment) {
      return this.envCache.layeredEnv
    }

    try {
      // 验证 .env 文件结构规则
      validateEnvironment()

      // 加载分层环境变量并检查必填变量
      const layeredEnv = envManager.collectEnvFromLayers('backend', environment)
      if (envManager.latestEnvWarnings && envManager.latestEnvWarnings.length > 0) {
        envManager.latestEnvWarnings.forEach(message => {
          logger.warn(message)
        })
      }

      const effectiveEnv = { ...process.env, ...layeredEnv }
      const requiredVars = envManager.getRequiredEnvVars(environment)
      if (requiredVars.length > 0) {
        const { valid, missing, placeholders } = envManager.validateRequiredVars(
          requiredVars,
          effectiveEnv,
        )
        if (!valid) {
          const problems = ['环境变量校验未通过']
          if (missing.length > 0) {
            problems.push(`缺少必填环境变量: ${missing.join(', ')}`)
          }
          if (placeholders.length > 0) {
            problems.push(`以下环境变量仍为占位值或空串: ${placeholders.join(', ')}`)
          }
          if (missing.length > 0 || placeholders.length > 0) {
            problems.push(`请在 .env.${environment} / .env.${environment}.local 中补齐配置`)
          }
          throw new Error(problems.join('\n'))
        }
      }

      // 验证成功，缓存结果
      this.envCache = { environment, layeredEnv }
      return layeredEnv
    } catch (error) {
      logger.error('环境变量验证失败')
      logger.error(error.message)
      process.exit(1)
    }
  }

  // 获取环境对应的命令行 flag
  getEnvironmentFlag(environment) {
    switch (environment) {
      case 'production':
        return '--prod'
      case 'staging':
        return '--staging'
      case 'test':
        return '--test'
      case 'e2e':
        return '--e2e'
      case 'development':
      default:
        return '--dev'
    }
  }

  // 主执行方法
  async run() {
    try {
      // 显示帮助
      if (this.flags.help || !this.command) {
        if (this.flags.help && this.command && this.command !== 'help') {
          showCommandHelp(this.command)
        } else {
          showHelp()
        }
        return
      }

      // 在执行命令前先校验参数与选项
      await this.ensureDependencies()
      await this.runStartupChecks()
      this.validateInputs()

      // 设置详细模式
      if (this.flags.verbose) {
        logger.debug('启用详细输出模式')
      }

      // 路由到对应的命令处理器
      await this.routeCommand()

    } catch (error) {
      logger.error('命令执行失败')
      logger.error(error.message)

      if (this.flags.verbose) {
        console.error(error.stack)
      }

      process.exit(1)
    }
  }

  // 命令路由
  async routeCommand() {
    const cleanArgs = getCleanArgs(this.args)
    const [command, ...subArgs] = cleanArgs

    if (!command) {
      showHelp()
      return
    }

    const handler = this.commandHandlers[command]
    if (!handler) {
      logger.error(`未知命令: ${command}`)
      showHelp()
      process.exit(1)
    }

    await handler(subArgs)
  }

  // 校验原始输入，禁止未识别的选项或多余参数
  validateInputs() {
    const cleanArgs = getCleanArgs(this.args)
    const command = cleanArgs[0]
    const allowedFlags = this.getAllowedFlags(command)
    const consumedFlagValueIndexes = this.validateFlags(command, allowedFlags)

    // 收集所有位置参数（不含命令本身、选项及其值）
    const positionalArgs = []
    let commandConsumed = false
    let afterDoubleDash = false
    for (let i = 0; i < this.args.length; i++) {
      const token = this.args[i]
      if (token === '--') {
        afterDoubleDash = true
        continue
      }
      if (afterDoubleDash) continue
      if (token.startsWith('-')) continue
      if (consumedFlagValueIndexes.has(i)) continue

      if (!commandConsumed && command) {
        // 跳过命令本身
        commandConsumed = true
        continue
      }

      positionalArgs.push(token)
    }

    if (!command) {
      if (positionalArgs.length > 0) {
        this.reportExtraPositionals('全局', positionalArgs)
      }
      return
    }

    this.validatePositionalArgs(command, positionalArgs)
  }

  // 获取命令允许的选项
  getAllowedFlags(command) {
    const allowed = new Map()
    const applyDefs = defs => {
      defs?.forEach(({ flag, expectsValue }) => {
        if (!flag) return
        allowed.set(flag, { expectsValue: Boolean(expectsValue) })
      })
    }

    applyDefs(this.flagDefinitions._global)
    if (command && this.flagDefinitions[command]) {
      applyDefs(this.flagDefinitions[command])
    }

    return allowed
  }

  // 校验选项合法性并返回被选项消耗的参数下标集合
  validateFlags(command, allowedFlags) {
    const consumedIndexes = new Set()
    const doubleDashIndex = this.args.indexOf('--')

    for (let i = 0; i < this.args.length; i++) {
      if (doubleDashIndex !== -1 && i >= doubleDashIndex) break
      const token = this.args[i]
      if (!token.startsWith('-')) continue

      const spec = allowedFlags.get(token)
      if (!spec) {
        this.reportUnknownFlag(command, token, allowedFlags)
        process.exit(1)
      }

      if (spec.expectsValue) {
        const next = this.args[i + 1]
        if (next === undefined || next.startsWith('-')) {
          logger.error(`选项 ${token} 需要提供参数值`)
          process.exit(1)
        }
        consumedIndexes.add(i + 1)
      }
    }

    return consumedIndexes
  }

  // 根据命令定义校验位置参数
  validatePositionalArgs(command, positionalArgs) {
    const ensureMax = (max) => {
      if (positionalArgs.length > max) {
        this.reportExtraPositionals(command, positionalArgs.slice(max))
      }
    }

    switch (command) {
      case 'help':
        ensureMax(1)
        break
      case 'build': {
        if (positionalArgs.length >= 2 && this.isEnvironmentToken(positionalArgs[1])) {
          this.reportEnvironmentFlagRequired(command, positionalArgs[1], positionalArgs)
        }
        ensureMax(1)
        break
      }
      case 'package': {
        if (positionalArgs.length >= 2 && this.isEnvironmentToken(positionalArgs[1])) {
          this.reportEnvironmentFlagRequired(command, positionalArgs[1], positionalArgs)
        }
        ensureMax(1)
        break
      }
      case 'db': {
        if (positionalArgs.length === 0) return
        const action = positionalArgs[0]
        const extras = positionalArgs.slice(1)
        const envToken = extras.find(token => this.isEnvironmentToken(token))
        if (envToken) {
          this.reportEnvironmentFlagRequired(command, envToken, positionalArgs)
        }

        if (action === 'migrate') {
          if (extras.length > 0) {
            this.reportExtraPositionals(command, extras)
          }
        } else if (action === 'deploy') {
          if (extras.length > 0) {
            this.reportExtraPositionals(command, extras)
          }
        } else if (action === 'script') {
          // script 子命令需要一个脚本名称参数
          if (extras.length > 1) {
            this.reportExtraPositionals(command, extras.slice(1))
          }
        } else if (extras.length > 0) {
          this.reportExtraPositionals(command, extras)
        }
        break
      }
      case 'test':
        ensureMax(3)
        break
      case 'worktree': {
        if (positionalArgs.length === 0) return
        const action = positionalArgs[0]
        if (['del', 'delete', 'rm'].includes(action)) {
          return
        }
        if (['make'].includes(action)) {
          ensureMax(3)
          break
        }
        if (['list', 'ls', 'clean', 'prune'].includes(action)) {
          ensureMax(1)
          break
        }
        break
      }
      case 'start': {
        const extras = positionalArgs.slice(1)
        const envToken = extras.find(token => this.isEnvironmentToken(token))
        if (envToken) {
          this.reportEnvironmentFlagRequired(command, envToken, positionalArgs)
        }
        ensureMax(1)
        break
      }
      case 'lint':
        ensureMax(0)
        break
      case 'clean':
        ensureMax(1)
        break
      case 'cache':
        ensureMax(1)
        break
      case 'status':
        ensureMax(0)
        break
      default:
        // 默认放行，具体命令内部再校验
        break
    }
  }

  isEnvironmentToken(token) {
    if (!token) return false
    const value = String(token).toLowerCase()
    return (
      value === 'dev' ||
      value === 'development' ||
      value === 'prod' ||
      value === 'production' ||
      value === 'staging' ||
      value === 'stage' ||
      value === 'test' ||
      value === 'e2e'
    )
  }

  reportEnvironmentFlagRequired(command, token, positionalArgs = []) {
    const normalizedFlag = this.getEnvironmentFlagExample(token)
    logger.error(`命令 ${command} 不再支持通过位置参数指定环境: ${token}`)
    logger.info('请使用带前缀的环境标志，例如 --dev、--staging、--prod、--test 或 --e2e。')
    const suggestion = normalizedFlag
      ? this.buildEnvironmentSuggestion(command, normalizedFlag, positionalArgs, token)
      : null
    if (suggestion) {
      logger.info(`建议命令: ${suggestion}`)
    } else if (normalizedFlag) {
      logger.info(`示例: ./scripts/dx ${command} ... ${normalizedFlag}`)
    }
    logger.info('未显式指定环境时将默认使用 --dev。')
    process.exit(1)
  }

  getEnvironmentFlagExample(token) {
    const key = this.normalizeEnvKey(token)
    switch (key) {
      case 'dev':
        return '--dev'
      case 'prod':
        return '--prod'
      case 'staging':
        return '--staging'
      case 'test':
        return '--test'
      case 'e2e':
        return '--e2e'
      default:
        return null
    }
  }

  buildEnvironmentSuggestion(command, normalizedFlag, positionalArgs, token) {
    const parts = ['./scripts/dx', command]
    const rest = Array.isArray(positionalArgs) ? [...positionalArgs] : []
    if (rest.length > 0) {
      const matchIndex = rest.findIndex(arg => String(arg).toLowerCase() === String(token).toLowerCase())
      if (matchIndex !== -1) rest.splice(matchIndex, 1)
    }
    if (!rest.includes(normalizedFlag)) {
      rest.push(normalizedFlag)
    }
    return parts.concat(rest).join(' ')
  }

  reportDevCommandRemoved(args) {
    const target = args?.[0]
    logger.error('`dx dev` 命令已移除，统一使用 `dx start`。')
    if (target) {
      logger.info(`请执行: ./scripts/dx start ${target} --dev`)
    } else {
      logger.info('示例: ./scripts/dx start backend --dev')
      logger.info('      ./scripts/dx start front --dev')
      logger.info('      ./scripts/dx start admin --dev')
    }
    process.exit(1)
  }

  reportExtraPositionals(command, extras) {
    const list = extras.join(', ')
    if (command === '全局') {
      logger.error(`检测到未识别的参数: ${list}`)
    } else {
      logger.error(`命令 ${command} 存在未识别的额外参数: ${list}`)
    }
    const hint = command && command !== '全局' ? `./scripts/dx help ${command}` : './scripts/dx --help'
    logger.info(`提示: 执行 ${hint} 或 ./scripts/dx --help 查看命令用法`)
    if (command && command !== '全局') {
      logger.info(`示例: ./scripts/dx ${command} --help`)
    }
    process.exit(1)
  }

  reportUnknownFlag(command, flag, allowedFlags) {
    logger.error(`检测到未识别的选项: ${flag}`)
    const supported = Array.from(allowedFlags.keys())
    if (supported.length > 0) {
      logger.info(`支持的选项: ${supported.join(', ')}`)
    } else if (command) {
      logger.info(`命令 ${command} 不接受额外选项`)
    }
    const hint = command ? `./scripts/dx help ${command}` : './scripts/dx --help'
    logger.info(`提示: 执行 ${hint} 或 ./scripts/dx --help 查看命令用法`)
    if (command) {
      logger.info(`示例: ./scripts/dx ${command} --help`)
    }
  }

  // 校验是否在仓库根目录执行
  ensureRepoRoot() {
    const cwd = process.cwd()
    const markers = [
      'pnpm-workspace.yaml',
      'package.json',
      'apps',
      'scripts/dx',
    ]
    const missing = markers.filter(p => !existsSync(join(cwd, p)))
    if (missing.length) {
      logger.error(`请从仓库根目录运行此命令。缺少标识文件/目录: ${missing.join(', ')}`)
      process.exit(1)
    }
  }

  async getWorktreeManager() {
    if (!this.worktreeManager) {
      const { default: worktreeManager } = await import('../worktree.js')
      this.worktreeManager = worktreeManager
    }
    return this.worktreeManager
  }

  // 并发命令处理
  async handleConcurrentCommands(commandPaths, baseCommand, environment) {
    const commands = []

    for (const path of commandPaths) {
      const config = this.resolveCommandPath(
        path,
        baseCommand,
        this.normalizeEnvKey(environment)
      )
      if (!config) {
        logger.warn(`未解析到命令配置: ${path} (${environment || '-'})`)
        continue
      }
      commands.push({
        command: this.applySdkOfflineFlag(config.command),
        options: {
          app: config.app,
          ports: config.ports,
          flags: this.flags,
        },
      })
    }

    if (commands.length > 0) {
      await execManager.executeConcurrent(commands)
    }
  }

  // 顺序命令处理
  async handleSequentialCommands(commandPaths, environment) {
    for (const path of commandPaths) {
      const config = this.resolveCommandPath(path, null, this.normalizeEnvKey(environment))
      if (!config) {
        logger.warn(`未解析到命令配置: ${path} (${environment || '-'})`)
        continue
      }

      // 支持在顺序执行中嵌套并发/顺序配置
      if (config.concurrent && Array.isArray(config.commands)) {
        await this.handleConcurrentCommands(config.commands, null, environment)
      } else if (config.sequential && Array.isArray(config.commands)) {
        await this.handleSequentialCommands(config.commands, environment)
      } else {
        await this.executeCommand(config)
      }
    }
  }

  // 解析命令路径
  resolveCommandPath(path, baseCommand, environment) {
    const parts = path.split('.')
    let config = this.commands

    for (const part of parts) {
      config = config[part]
      if (!config) break
    }

    // 如果有环境参数，尝试获取对应环境的配置
    if (environment && config) {
      const envKey = this.normalizeEnvKey(environment)
      if (config[envKey]) config = config[envKey]
      else if (envKey === 'staging' && config.prod) config = config.prod
    }

    return config
  }

  // SDK 构建命令当前不再暴露 --online/--offline 模式，保留该方法仅为兼容旧调用
  applySdkModeFlags(command) {
    return command
  }

  // 向后兼容的别名
  applySdkOfflineFlag(command) {
    return command
  }

  collectStartPorts(service, startConfig, envKey) {
    const portSet = new Set()

    if (startConfig && Array.isArray(startConfig.ports)) {
      startConfig.ports.forEach(port => this.addPortToSet(portSet, port))
    }

    if (envKey === 'dev') {
      const legacyConfig = this.commands.dev?.[service]
      if (legacyConfig && Array.isArray(legacyConfig.ports)) {
        legacyConfig.ports.forEach(port => this.addPortToSet(portSet, port))
      }
    }

    return Array.from(portSet)
  }

  addPortToSet(target, port) {
    const numeric = Number(port)
    if (Number.isFinite(numeric) && numeric > 0) {
      target.add(numeric)
    }
  }

  // 执行单个命令
  async executeCommand(config, overrideFlags) {
    if (!config || !config.command) {
      logger.error('无效的命令配置')
      return
    }

    const command = this.applySdkOfflineFlag(config.command)

    const options = {
      app: config.app,
      flags: overrideFlags || this.flags,
      ports: config.ports || [],
      // 允许上游在 config.env 中注入环境变量（例如 NX_CACHE=false）
      env: config.env || {},
      skipEnvValidation: Boolean(config.skipEnvValidation),
      forcePortCleanup: Boolean(config.forcePortCleanup),
    }

    await execManager.executeCommand(command, options)
  }

  // 确定环境
  determineEnvironment() {
    return envManager.detectEnvironment(this.flags)
  }

  // 规范化环境键到命令配置使用的命名（dev/prod/test/e2e）
  normalizeEnvKey(env) {
    switch (String(env || '').toLowerCase()) {
      case 'development':
      case 'dev':
        return 'dev'
      case 'production':
      case 'prod':
        return 'prod'
      case 'staging':
      case 'stage':
        return 'staging'
      case 'test':
        return 'test'
      case 'e2e':
        return 'e2e'
      default:
        return env
    }
  }

}

export { DxCli }
