import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma'
import type { ClsService } from 'nestjs-cls'
// eslint-disable-next-line ts/consistent-type-imports
import { TransactionHost } from '@nestjs-cls/transactional'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClsService as ClsServiceToken } from 'nestjs-cls'

const AFTER_COMMIT_TASKS_KEY = 'AFTER_COMMIT_TASKS'

type Task = () => void | Promise<void>

@Injectable()
export class TransactionEventsService {
  private readonly logger = new Logger(TransactionEventsService.name)

  constructor(
    @Inject(ClsServiceToken) private readonly cls: ClsService,
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma>,
  ) {}

  afterCommit(task: Task): void {
    let inTx: boolean

    try {
      inTx = this.txHost.isTransactionActive()
    } catch (error) {
      this.rejectUnsafeAfterCommit(
        `afterCommit called without CLS context; use withAfterCommit() for non-HTTP work: ${(error as Error)?.message}`,
      )
      return
    }

    if (!inTx) {
      this.rejectUnsafeAfterCommit(
        'afterCommit called without an active transaction; use @TransactionalWithAfterCommit() for HTTP handlers or withAfterCommit() for non-HTTP work',
      )
      return
    }

    const list = (this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []
    list.push(task)
    this.cls.set(AFTER_COMMIT_TASKS_KEY, list)
  }

  private rejectUnsafeAfterCommit(message: string): void {
    if (process.env.NODE_ENV === 'test') {
      throw new Error(message)
    }
    this.logger.error(message)
  }

  drainAfterCommitTasks(): Task[] {
    try {
      const list = ((this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []).slice()
      this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
      return list
    } catch {
      return []
    }
  }

  async runTasks(tasks: Task[]): Promise<{ success: number; failed: number; errors: Error[] }> {
    let success = 0
    const errors: Error[] = []
    for (const task of tasks) {
      try {
        await task()
        success++
      } catch (error) {
        const err = error as Error
        errors.push(err)
        this.logger.error(`afterCommit task failed: ${err.message}`, err.stack)
      }
    }
    return { success, failed: errors.length, errors }
  }

  reset(): void {
    try {
      this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
    } catch {
      // 无 CLS 上下文时跳过重置
    }
  }

  /**
   * 非 HTTP 场景（Bull Job / Subscriber / Scheduler）的便捷方法。
   * 自动创建 CLS 上下文 + 开启事务 + drain afterCommit。
   */
  async withAfterCommit<T>(fn: () => Promise<T>): Promise<T> {
    const execute = async (): Promise<T> => {
      this.reset()
      const result = await this.txHost.withTransaction(fn)
      const tasks = this.drainAfterCommitTasks()
      await this.runTasks(tasks)
      return result
    }

    if (this.cls.isActive()) {
      return execute()
    }
    return this.cls.run(execute)
  }
}
