import { MessageBusDedupeService } from '../runtime/message-bus.dedupe.service'
import { MessageEnvelope } from '../message-bus.types'
import { Job } from 'bull'

export function IdempotentConsumer<TPayload = any>(
  keyFn: (job: Job<MessageEnvelope<TPayload>>) => string,
  opts?: { ttlSec?: number },
) {
  const ttl = Math.max(1, opts?.ttlSec ?? 300)
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(job: Job<MessageEnvelope<TPayload>>) => any>,
  ) {
    const original = descriptor.value!
    descriptor.value = async function (job: Job<MessageEnvelope<TPayload>>) {
      const dedupe = MessageBusDedupeService.getInstance()
      const rawKey = keyFn(job)
      const key = dedupe ? dedupe.buildKey(rawKey) : rawKey

      // 仅在首次尝试时做幂等防重；重试路径不阻断执行
      let acquired = true
      if (dedupe && (job.attemptsMade ?? 0) === 0) {
        acquired = await dedupe.setIfNotExists(key, ttl)
        if (!acquired) return
      }
      try {
        return await original.apply(this, [job])
      } catch (err) {
        // 首尝获取过幂等锁但执行失败，删除幂等键以允许后续重试继续执行
        if (dedupe && acquired && (job.attemptsMade ?? 0) === 0) {
          try {
            await dedupe.del(key)
          } catch {}
        }
        throw err
      }
    }
    return descriptor
  }
}
