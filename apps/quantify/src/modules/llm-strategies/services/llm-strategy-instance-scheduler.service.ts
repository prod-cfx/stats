import type { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { LlmStrategyInstance } from '@prisma/client'
import { Injectable, Logger } from '@nestjs/common'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤 SchedulerRegistry
import { SchedulerRegistry } from '@nestjs/schedule'
import { CronJob } from 'cron'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { PrismaService } from '@/prisma/prisma.service'
// eslint-disable-next-line ts/consistent-type-imports -- Nest DI 闇€瑕佽繍琛屾椂寮曠敤
import { LlmOrchestratedEngineV3 } from '../llm-orchestrated-engine-v3.service'

/**
 * LLM绛栫暐瀹炰緥绾у埆鐨勮皟搴︽湇鍔?
 * 璐熻矗绠＄悊姣忎釜LLM瀹炰緥鐙珛鐨?cron 浠诲姟锛屽疄鐜帮細
 * - 瀹炰緥鍚姩鏃惰嚜鍔ㄥ垱寤?cron 浠诲姟
 * - 瀹炰緥鍋滄鏃惰嚜鍔ㄩ攢姣?cron 浠诲姟
 * - 鏀寔瀹炰緥绾у埆鐨勮嚜瀹氫箟 scheduleCron 琛ㄨ揪寮?
 * - 鏈嶅姟鍚姩鏃惰嚜鍔ㄦ仮澶嶆墍鏈?running 鐘舵€佸疄渚嬬殑浠诲姟
 */
@Injectable()
export class LlmStrategyInstanceSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LlmStrategyInstanceSchedulerService.name)
  private readonly instanceJobs = new Map<string, CronJob>()
  private readonly DEFAULT_CRON_EXPRESSION = '*/15 * * * *' // 榛樿姣?5鍒嗛挓

  // 馃敡 骞跺彂鎺у埗锛氫负姣忎釜瀹炰緥缁存姢涓€涓搷浣滈槦鍒?
  private readonly operationLocks = new Map<string, Promise<void>>()

  // 馃敡 鎵ц閿侊細瀛樺偍姣忎釜瀹炰緥姝ｅ湪鎵ц鐨?Promise锛岀敤浜庨槻姝㈠苟鍙戝拰绛夊緟瀹屾垚
  private readonly executionLocks = new Map<string, Promise<void>>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly engine: LlmOrchestratedEngineV3,
  ) {}

  /**
   * 妯″潡鍒濆鍖栨椂鎭㈠鎵€鏈?running 鐘舵€佺殑瀹炰緥璋冨害
   */
  async onModuleInit() {
    this.logger.log('鍒濆鍖朙LM绛栫暐瀹炰緥璋冨害鏈嶅姟...')

    // 馃敡 楠岃瘉榛樿cron琛ㄨ揪寮?
    if (!this.validateCronExpression(this.DEFAULT_CRON_EXPRESSION)) {
      throw new Error(`Invalid default cron expression: ${this.DEFAULT_CRON_EXPRESSION}`)
    }

    await this.recoverRunningInstances()
  }

  /**
   * 妯″潡閿€姣佹椂娓呯悊鎵€鏈夎皟搴︿换鍔?
   */
  onModuleDestroy() {
    this.logger.log('娓呯悊鎵€鏈塋LM绛栫暐瀹炰緥璋冨害浠诲姟...')
    this.stopAllInstances()
  }

  /**
   * 鎭㈠鎵€鏈?running 鐘舵€佷笖鍚敤浜嗚皟搴︾殑瀹炰緥
   * 娉ㄦ剰锛氳烦杩?scheduleCron 涓?null 鐨勫疄渚嬶紙琛ㄧず绠＄悊鍛樻槑纭仠鐢ㄤ簡鑷姩璋冨害锛?
   */
  private async recoverRunningInstances() {
    try {
      const runningInstances = await this.prisma.llmStrategyInstance.findMany({
        where: {
          status: 'running',
          // 馃敡 鍙仮澶嶅凡閰嶇疆 scheduleCron 鐨勫疄渚嬶紝璺宠繃鏄惧紡鍋滅敤璋冨害鐨勫疄渚?
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
        `鍙戠幇 ${runningInstances.length} 涓?running 鐘舵€佺殑LLM瀹炰緥锛屾鍦ㄦ仮澶嶈皟搴?..`
      )

      for (const instance of runningInstances) {
        // 鍙仮澶嶆湁鏁堢殑瀹炰緥锛堢瓥鐣ヤ负 live 鐘舵€侊級
        if (instance.strategy.status === 'live') {
          await this.startInstance(instance)
        } else {
          this.logger.warn(
            `璺宠繃LLM瀹炰緥 ${instance.id}锛氬叧鑱旂瓥鐣?${instance.strategy.id} 鐘舵€佷负 ${instance.strategy.status}`,
          )
        }
      }

      this.logger.log(`鎴愬姛鎭㈠ ${this.instanceJobs.size} 涓狶LM瀹炰緥鐨勮皟搴︿换鍔)
    } catch (error) {
      this.logger.error(`鎭㈠LLM瀹炰緥璋冨害澶辫触: ${(error as Error).message}`, (error as Error).stack)
    }
  }

  /**
   * 鍚姩瀹炰緥鐨勮皟搴︿换鍔?
   * @param instance LLM绛栫暐瀹炰緥鎴栧疄渚婭D
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

    // 馃敡 浣跨敤骞跺彂閿佷繚鎶?
    return this.withLock(instanceData.id, async () => {
      // 馃敡 浣跨敤 try-finally 纭繚澶辫触鏃朵篃鑳芥竻鐞?
      try {
      // 濡傛灉宸插瓨鍦紝寮哄埗娓呯悊
      if (this.instanceJobs.has(instanceData.id)) {
        this.logger.warn(`Instance ${instanceData.id} already has a scheduled job, cleaning up...`)
        await this.forceCleanup(instanceData.id)
      }

      // 妫€鏌ユ槸鍚﹁缃簡 scheduleCron
      if (!instanceData.scheduleCron) {
        this.logger.debug(`LLM瀹炰緥 ${instanceData.id} 鏈缃?scheduleCron锛屼娇鐢ㄩ粯璁ゅ€糮)
      }

      // 鑾峰彇 cron 琛ㄨ揪寮忥紙瀹炰緥绾у埆 > 榛樿锛?
      const cronExpression = instanceData.scheduleCron ?? this.DEFAULT_CRON_EXPRESSION

      // 馃敡 楠岃瘉cron琛ㄨ揪寮?
      if (!this.validateCronExpression(cronExpression)) {
        const error = `Invalid cron expression: ${cronExpression}`
        this.logger.error(error)
        throw new Error(error)
      }

      // 鍒涘缓 cron 浠诲姟
      const cronJob = new CronJob(cronExpression, async () => {
        const instanceId = instanceData.id

        // 馃敡 妫€鏌ユ墽琛岄攣锛氬鏋滀笂涓€娆℃帹鐞嗕粛鍦ㄨ繘琛屼腑锛岃烦杩囨湰娆¤Е鍙?
        if (this.executionLocks.has(instanceId)) {
          this.logger.warn(
            `[Cron] LLM瀹炰緥 ${instanceId} 浠嶅湪鎵ц涓紝璺宠繃鏈璋冨害瑙﹀彂锛堥槻姝㈠苟鍙戞墽琛岋級`
          )
          return
        }

        // 馃敡 鍒涘缓鎵ц Promise 骞跺瓨鍌ㄥ埌閿佷腑
        const executionPromise = (async () => {
          try {
            this.logger.debug(`[Cron] 瑙﹀彂LLM瀹炰緥 ${instanceId} 鐨勬墽琛宍)

            // 璋冪敤 LlmOrchestratedEngineV3 鎵ц绛栫暐
            await this.engine.runForInstance(
              instanceId,
              instanceData.createdBy,
              {
                triggerSource: 'cron_schedule',
                now: new Date(),
              },
              {
                skipGuards: false, // 閬靛惊姝ｅ父鐨勯鐜囬檺鍒躲€佸喎鍗存椂闂寸瓑
              }
            )
          } catch (error) {
            const detail = error instanceof Error ? error.stack ?? error.message : String(error)
            this.logger.error(`[Cron] LLM瀹炰緥 ${instanceId} 鎵ц澶辫触: ${detail}`)
          } finally {
            // 馃敡 鎵ц瀹屾垚鍚庨噴鏀鹃攣
            this.executionLocks.delete(instanceId)
          }
        })()

        // 馃敡 瀛樺偍鎵ц Promise
        this.executionLocks.set(instanceId, executionPromise)
      })

      // 娉ㄥ唽鍒拌皟搴﹀櫒
      const jobName = this.getJobName(instanceData.id)
      this.schedulerRegistry.addCronJob(jobName, cronJob)
      cronJob.start()

      // 淇濆瓨鍒板唴瀛?
      this.instanceJobs.set(instanceData.id, cronJob)

      this.logger.log(
        `鉁?鍚姩LLM瀹炰緥 ${instanceData.id} 鐨勮皟搴︿换鍔★紝cron: ${cronExpression}`,
      )
      } catch (error) {
        // 馃敡 纭繚澶辫触鏃朵篃娓呯悊
        this.forceCleanup(instanceData.id)

        this.logger.error(
          `鍚姩LLM瀹炰緥 ${instanceData.id} 鐨勮皟搴︿换鍔″け璐? ${(error as Error).message}`,
          (error as Error).stack,
        )
        throw error
      }
    })
  }

  /**
   * 鍋滄瀹炰緥鐨勮皟搴︿换鍔?
   * @param instanceId 瀹炰緥ID
   */
  stopInstance(instanceId: string): Promise<void> {
    // 馃敡 浣跨敤骞跺彂閿佷繚鎶?
    return this.withLock(instanceId, async () => {
      const cronJob = this.instanceJobs.get(instanceId)
      if (!cronJob) {
        this.logger.debug(`LLM瀹炰緥 ${instanceId} 娌℃湁杩愯涓殑璋冨害浠诲姟`)
        return
      }

      try {
        // 鍋滄 cron 浠诲姟
        cronJob.stop()

        // 浠庤皟搴﹀櫒绉婚櫎
        const jobName = this.getJobName(instanceId)
        if (this.schedulerRegistry.doesExist('cron', jobName)) {
          this.schedulerRegistry.deleteCronJob(jobName)
        }

        // 浠庡唴瀛樼Щ闄?
        this.instanceJobs.delete(instanceId)

        // 馃敡 绛夊緟褰撳墠鎵ц瀹屾垚鍚庡啀娓呯悊鎵ц閿?
        const executionPromise = this.executionLocks.get(instanceId)
        if (executionPromise) {
          this.logger.debug(`绛夊緟LLM瀹炰緥 ${instanceId} 鐨勫綋鍓嶆墽琛屽畬鎴?..`)
          await executionPromise
          this.logger.debug(`LLM瀹炰緥 ${instanceId} 鐨勬墽琛屽凡瀹屾垚`)
        }

        this.logger.log(`鈴癸笍 鍋滄LLM瀹炰緥 ${instanceId} 鐨勮皟搴︿换鍔)
      } catch (error) {
        this.logger.error(
          `鍋滄LLM瀹炰緥 ${instanceId} 鐨勮皟搴︿换鍔″け璐? ${(error as Error).message}`,
          (error as Error).stack,
        )
      }
    })
  }

  /**
   * 閲嶅惎瀹炰緥鐨勮皟搴︿换鍔★紙鐢ㄤ簬鏇存柊 scheduleCron 绛夛級
   * @param instanceId 瀹炰緥ID
   */
  async restartInstance(instanceId: string): Promise<void> {
    this.stopInstance(instanceId)
    await this.startInstance(instanceId)
  }

  /**
   * 鍋滄鎵€鏈夊疄渚嬬殑璋冨害浠诲姟
   */
  stopAllInstances(): void {
    const instanceIds = Array.from(this.instanceJobs.keys())
    this.logger.log(`鍋滄 ${instanceIds.length} 涓狶LM瀹炰緥鐨勮皟搴︿换鍔)

    for (const instanceId of instanceIds) {
      this.stopInstance(instanceId)
    }
  }

  /**
   * 鑾峰彇褰撳墠杩愯涓殑瀹炰緥璋冨害浠诲姟鏁伴噺
   */
  getRunningInstancesCount(): number {
    return this.instanceJobs.size
  }

  /**
   * 鑾峰彇鎵€鏈夎繍琛屼腑鐨勫疄渚婭D鍒楄〃
   */
  getRunningInstanceIds(): string[] {
    return Array.from(this.instanceJobs.keys())
  }

  /**
   * 妫€鏌ュ疄渚嬫槸鍚︽湁杩愯涓殑璋冨害浠诲姟
   */
  isInstanceRunning(instanceId: string): boolean {
    return this.instanceJobs.has(instanceId)
  }

  /**
   * 鑾峰彇璋冨害鍣ㄧ洃鎺ф寚鏍?
   */
  getMetrics() {
    return {
      activeJobs: this.instanceJobs.size,
      runningInstances: this.getRunningInstanceIds(),
      pendingOperations: this.operationLocks.size,
    }
  }

  /**
   * 浣跨敤骞跺彂閿佷繚鎶ゆ搷浣?
   * 纭繚瀵瑰悓涓€瀹炰緥鐨勬搷浣滀覆琛屾墽琛?
   * @param instanceId 瀹炰緥ID
   * @param operation 瑕佹墽琛岀殑鎿嶄綔
   */
  private async withLock<T>(instanceId: string, operation: () => T | Promise<T>): Promise<T> {
    // 绛夊緟涔嬪墠鐨勬搷浣滃畬鎴?
    const existingLock = this.operationLocks.get(instanceId)
    if (existingLock) {
      await existingLock.catch(() => {
        // 蹇界暐涔嬪墠鎿嶄綔鐨勯敊璇?
      })
    }

    // 鍒涘缓鏂扮殑閿?
    const lockPromise = (async () => {
      try {
        return await operation()
      } finally {
        // 鎿嶄綔瀹屾垚鍚庢竻闄ら攣锛堝鏋滄槸褰撳墠閿侊級
        if (this.operationLocks.get(instanceId) === lockPromise) {
          this.operationLocks.delete(instanceId)
        }
      }
    })()

    this.operationLocks.set(instanceId, lockPromise as Promise<void>)
    return lockPromise
  }

  /**
   * 楠岃瘉cron琛ㄨ揪寮忔槸鍚︽湁鏁?
   * @param expression cron琛ㄨ揪寮?
   * @returns 鏄惁鏈夋晥
   */
  private validateCronExpression(expression: string): boolean {
    try {
      // 灏濊瘯鍒涘缓CronJob鏉ラ獙璇佽〃杈惧紡锛堢珛鍗冲仠姝互閬垮厤鍓綔鐢級
      const job = new CronJob(expression, () => {})
      job.stop()
      return true
    } catch {
      return false
    }
  }

  /**
   * 寮哄埗娓呯悊瀹炰緥鐨勮皟搴︿换鍔★紙鍗充娇鍑洪敊涔熶笉鎶涘紓甯革級
   * 鐢ㄤ簬闃叉鍐呭瓨娉勬紡鍜岄噸澶嶄换鍔?
   * @param instanceId 瀹炰緥ID
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
   * 鐢熸垚璋冨害浠诲姟鍚嶇О
   */
  private getJobName(instanceId: string): string {
    return `llm-strategy-instance.${instanceId}`
  }
}
