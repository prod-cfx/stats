import type { ClsService } from 'nestjs-cls'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ClsService as ClsServiceToken } from 'nestjs-cls'

const AFTER_COMMIT_TASKS_KEY = 'AFTER_COMMIT_TASKS'

type Task = () => void | Promise<void>

@Injectable()
export class TransactionEventsService {
  private readonly logger = new Logger(TransactionEventsService.name)

  constructor(@Inject(ClsServiceToken) private readonly cls: ClsService) {}

  afterCommit(task: Task): void {
    try {
      const inTx = Boolean(this.cls.get('PRISMA_TRANSACTION'))
      if (!inTx) {
        Promise.resolve()
          .then(() => task())
          .catch(error => {
            const meta = { err: (error as Error)?.message, stack: (error as Error)?.stack }
            this.logger.warn(`afterCommit fallback task failed: ${meta.err}\n${meta.stack ?? ''}`)
          })
        return
      }

      const list = (this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []
      list.push(task)
      this.cls.set(AFTER_COMMIT_TASKS_KEY, list)
    } catch (error) {
      // 当 CLS 上下文不存在时，直接以非事务方式执行任务，避免抛出异常导致请求失败
      this.logger.warn(
        `afterCommit called without CLS context, executing task immediately: ${(error as Error)?.message}`,
      )
      Promise.resolve()
        .then(() => task())
        .catch(err => {
          const meta = { err: (err as Error)?.message, stack: (err as Error)?.stack }
          this.logger.warn(`afterCommit fallback task failed: ${meta.err}\n${meta.stack ?? ''}`)
        })
    }
  }

  drainAfterCommitTasks(): Task[] {
    try {
      const list = ((this.cls.get(AFTER_COMMIT_TASKS_KEY) as Task[] | undefined) || []).slice()
      this.cls.set(AFTER_COMMIT_TASKS_KEY, [])
      return list
    } catch {
      // 无 CLS 上下文时直接返回空任务列表
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
}

