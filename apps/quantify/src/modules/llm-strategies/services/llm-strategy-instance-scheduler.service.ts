import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { LlmStrategyInstance } from '@/prisma/prisma.types'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用 SchedulerRegistry
import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 需要运行时引用
import { LlmOrchestratedEngineV3 } from '../llm-orchestrated-engine-v3.service'

/**
 * LLM策略实例级别的调度服务
 * 负责管理每个LLM实例独立的 cron 任务，实现：
 * - 实例启动时自动创建 cron 任务
 * - 实例停止时自动销毁 cron 任务
 * - 支持实例级别的自定义 scheduleCron 表达式
 * - 服务启动时自动恢复所有 running 状态实例的任务
 */
@Injectable()
export class LlmStrategyInstanceSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LlmStrategyInstanceSchedulerService.name)
  private readonly instanceJobs = new Map<string, CronJob>()
  private readonly DEFAULT_CRON_EXPRESSION = '*/15 * * * *' // 默认每15分钟
  
  // 🔧 并发控制：为每个实例维护一个操作队列
  private readonly operationLocks = new Map<string, Promise<void>>()
  
  // 🔧 执行锁：存储每个实例正在执行的 Promise，用于防止并发和等待完成
  private readonly executionLocks = new Map<string, Promise<void>>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly engine: LlmOrchestratedEngineV3,
  ) {}

  /**
   * 模块初始化时恢复所有 running 状态的实例调度
   */
  async onModuleInit() {
    this.logger.log('初始化LLM策略实例调度服务...')
    
    // 🔧 验证默认cron表达式
    if (!this.validateCronExpression(this.DEFAULT_CRON_EXPRESSION)) {
      throw new Error(`Invalid default cron expression: ${this.DEFAULT_CRON_EXPRESSION}`)
    }
    
    await this.recoverRunningInstances()
  }

  /**
   * 模块销毁时清理所有调度任务
   */
  onModuleDestroy() {
    this.logger.log('清理所有LLM策略实例调度任务...')
    this.stopAllInstances()
  }

  /**
   * 恢复所有 running 状态且启用了调度的实例
   * 注意：跳过 scheduleCron 为 null 的实例（表示管理员明确停用了自动调度）
   */
  private async recoverRunningInstances() {
    try {
      const runningInstances = await this.prisma.llmStrategyInstance.findMany({
        where: {
          status: 'running',
          // 🔧 只恢复已配置 scheduleCron 的实例，跳过显式停用调度的实例
          scheduleCron: {
            not: null,
          },
        },
        include: {
          strategy: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      })

      this.logger.log(
        `发现 ${runningInstances.length} 个 running 状态的LLM实例，正在恢复调度...`
      )

      for (const instance of runningInstances) {
        // 只恢复有效的实例（策略为 live 状态）
        if (instance.strategy.status === 'live') {
          await this.startInstance(instance)
        } else {
          this.logger.warn(
            `跳过LLM实例 ${instance.id}：关联策略 ${instance.strategy.id} 状态为 ${instance.strategy.status}`,
          )
        }
      }

      this.logger.log(`成功恢复 ${this.instanceJobs.size} 个LLM实例的调度任务`)
    } catch (error) {
      this.logger.error(`恢复LLM实例调度失败: ${(error as Error).message}`, (error as Error).stack)
    }
  }

  /**
   * 启动实例的调度任务
   * @param instance LLM策略实例或实例ID
   */
  async startInstance(instance: LlmStrategyInstance | string): Promise<void> {
    const instanceData = typeof instance === 'string'
      ? await this.prisma.llmStrategyInstance.findUnique({ 
          where: { id: instance },
          include: { strategy: true }
        })
      : instance

    if (!instanceData) {
      throw new Error(`LLM strategy instance ${instance} not found`)
    }

    // 🔧 使用并发锁保护
    return this.withLock(instanceData.id, async () => {
      // 🔧 使用 try-finally 确保失败时也能清理
      try {
      // 如果已存在，强制清理
      if (this.instanceJobs.has(instanceData.id)) {
        this.logger.warn(`Instance ${instanceData.id} already has a scheduled job, cleaning up...`)
        await this.forceCleanup(instanceData.id)
      }

      // 检查是否设置了 scheduleCron
      if (!instanceData.scheduleCron) {
        this.logger.debug(`LLM实例 ${instanceData.id} 未设置 scheduleCron，使用默认值`)
      }

      // 获取 cron 表达式（实例级别 > 默认）
      const cronExpression = instanceData.scheduleCron ?? this.DEFAULT_CRON_EXPRESSION
      
      // 🔧 验证cron表达式
      if (!this.validateCronExpression(cronExpression)) {
        const error = `Invalid cron expression: ${cronExpression}`
        this.logger.error(error)
        throw new Error(error)
      }

      // 创建 cron 任务
      const cronJob = new CronJob(cronExpression, async () => {
        const instanceId = instanceData.id
        
        // 🔧 检查执行锁：如果上一次推理仍在进行中，跳过本次触发
        if (this.executionLocks.has(instanceId)) {
          this.logger.warn(
            `[Cron] LLM实例 ${instanceId} 仍在执行中，跳过本次调度触发（防止并发执行）`
          )
          return
        }
        
        // 🔧 创建执行 Promise 并存储到锁中
        const executionPromise = (async () => {
          try {
            this.logger.debug(`[Cron] 触发LLM实例 ${instanceId} 的执行`)
            
            // 调用 LlmOrchestratedEngineV3 执行策略
            await this.engine.runForInstance(
              instanceId,
              instanceData.createdBy,
              {
                triggerSource: 'cron_schedule',
                now: new Date(),
              },
              {
                skipGuards: false, // 遵循正常的频率限制、冷却时间等
              }
            )
          } catch (error) {
            const detail = error instanceof Error ? error.stack ?? error.message : String(error)
            this.logger.error(`[Cron] LLM实例 ${instanceId} 执行失败: ${detail}`)
          } finally {
            // 🔧 执行完成后释放锁
            this.executionLocks.delete(instanceId)
          }
        })()
        
        // 🔧 存储执行 Promise
        this.executionLocks.set(instanceId, executionPromise)
      })

      // 注册到调度器
      const jobName = this.getJobName(instanceData.id)
      this.schedulerRegistry.addCronJob(jobName, cronJob)
      cronJob.start()

      // 保存到内存
      this.instanceJobs.set(instanceData.id, cronJob)

      this.logger.log(
        `✅ 启动LLM实例 ${instanceData.id} 的调度任务，cron: ${cronExpression}`,
      )
      } catch (error) {
        // 🔧 确保失败时也清理
        this.forceCleanup(instanceData.id)
        
        this.logger.error(
          `启动LLM实例 ${instanceData.id} 的调度任务失败: ${(error as Error).message}`,
          (error as Error).stack,
        )
        throw error
      }
    })
  }

  /**
   * 停止实例的调度任务
   * @param instanceId 实例ID
   */
  stopInstance(instanceId: string): Promise<void> {
    // 🔧 使用并发锁保护
    return this.withLock(instanceId, async () => {
      const cronJob = this.instanceJobs.get(instanceId)
      if (!cronJob) {
        this.logger.debug(`LLM实例 ${instanceId} 没有运行中的调度任务`)
        return
      }

      try {
        // 停止 cron 任务
        cronJob.stop()

        // 从调度器移除
        const jobName = this.getJobName(instanceId)
        if (this.schedulerRegistry.doesExist('cron', jobName)) {
          this.schedulerRegistry.deleteCronJob(jobName)
        }

        // 从内存移除
        this.instanceJobs.delete(instanceId)
        
        // 🔧 等待当前执行完成后再清理执行锁
        const executionPromise = this.executionLocks.get(instanceId)
        if (executionPromise) {
          this.logger.debug(`等待LLM实例 ${instanceId} 的当前执行完成...`)
          await executionPromise
          this.logger.debug(`LLM实例 ${instanceId} 的执行已完成`)
        }

        this.logger.log(`⏹️ 停止LLM实例 ${instanceId} 的调度任务`)
      } catch (error) {
        this.logger.error(
          `停止LLM实例 ${instanceId} 的调度任务失败: ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    })
  }

  /**
   * 重启实例的调度任务（用于更新 scheduleCron 等）
   * @param instanceId 实例ID
   */
  async restartInstance(instanceId: string): Promise<void> {
    this.stopInstance(instanceId)
    await this.startInstance(instanceId)
  }

  /**
   * 停止所有实例的调度任务
   */
  stopAllInstances(): void {
    const instanceIds = Array.from(this.instanceJobs.keys())
    this.logger.log(`停止 ${instanceIds.length} 个LLM实例的调度任务`)

    for (const instanceId of instanceIds) {
      this.stopInstance(instanceId)
    }
  }

  /**
   * 获取当前运行中的实例调度任务数量
   */
  getRunningInstancesCount(): number {
    return this.instanceJobs.size
  }

  /**
   * 获取所有运行中的实例ID列表
   */
  getRunningInstanceIds(): string[] {
    return Array.from(this.instanceJobs.keys())
  }

  /**
   * 检查实例是否有运行中的调度任务
   */
  isInstanceRunning(instanceId: string): boolean {
    return this.instanceJobs.has(instanceId)
  }

  /**
   * 获取调度器监控指标
   */
  getMetrics() {
    return {
      activeJobs: this.instanceJobs.size,
      runningInstances: this.getRunningInstanceIds(),
      pendingOperations: this.operationLocks.size,
    }
  }

  /**
   * 使用并发锁保护操作
   * 确保对同一实例的操作串行执行
   * @param instanceId 实例ID
   * @param operation 要执行的操作
   */
  private async withLock<T>(instanceId: string, operation: () => T | Promise<T>): Promise<T> {
    // 等待之前的操作完成
    const existingLock = this.operationLocks.get(instanceId)
    if (existingLock) {
      await existingLock.catch(() => {
        // 忽略之前操作的错误
      })
    }

    // 创建新的锁
    const lockPromise = (async () => {
      try {
        return await operation()
      } finally {
        // 操作完成后清除锁（如果是当前锁）
        if (this.operationLocks.get(instanceId) === lockPromise) {
          this.operationLocks.delete(instanceId)
        }
      }
    })()

    this.operationLocks.set(instanceId, lockPromise as Promise<void>)
    return lockPromise
  }

  /**
   * 验证cron表达式是否有效
   * @param expression cron表达式
   * @returns 是否有效
   */
  private validateCronExpression(expression: string): boolean {
    try {
      // 尝试创建CronJob来验证表达式（立即停止以避免副作用）
      const job = new CronJob(expression, () => {})
      job.stop()
      return true
    } catch {
      return false
    }
  }

  /**
   * 强制清理实例的调度任务（即使出错也不抛异常）
   * 用于防止内存泄漏和重复任务
   * @param instanceId 实例ID
   */
  private forceCleanup(instanceId: string): void {
    try {
      const cronJob = this.instanceJobs.get(instanceId)
      if (cronJob) {
        try {
          cronJob.stop()
        } catch (error) {
          this.logger.warn(`Failed to stop cron job for instance ${instanceId}: ${(error as Error).message}`)
        }
      }
      
      const jobName = this.getJobName(instanceId)
      if (this.schedulerRegistry.doesExist('cron', jobName)) {
        try {
          this.schedulerRegistry.deleteCronJob(jobName)
        } catch (error) {
          this.logger.warn(`Failed to delete cron job ${jobName}: ${(error as Error).message}`)
        }
      }
      
      this.instanceJobs.delete(instanceId)
      this.logger.debug(`Force cleanup completed for instance ${instanceId}`)
    } catch (error) {
      this.logger.error(`Force cleanup failed for ${instanceId}: ${(error as Error).message}`)
    }
  }

  /**
   * 生成调度任务名称
   */
  private getJobName(instanceId: string): string {
    return `llm-strategy-instance.${instanceId}`
  }
}
