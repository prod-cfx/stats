import type { MessageEnvelope, PublishOptions } from '../message-bus.types'
import { MessageBusService } from '../message-bus.service'
import { OutboxService } from '../outbox/outbox.service'

type ValueOrFn<TArgs extends any[], T> = T | ((...args: TArgs) => T)

function resolve<TArgs extends any[], T>(v: ValueOrFn<TArgs, T>, args: TArgs): T {
  return typeof v === 'function' ? (v as any)(...args) : v
}

export interface PublishDecoratorOptions<TArgs extends any[] = any[]> {
  topic: ValueOrFn<TArgs, string>
  type: ValueOrFn<TArgs, string>
  data?: ValueOrFn<TArgs, unknown>
  options?: ValueOrFn<TArgs, PublishOptions | undefined>
}

export function Publish<TArgs extends any[] = any[]>(opts: PublishDecoratorOptions<TArgs>) {
  return function (
    _target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<(...args: TArgs) => any>,
  ) {
    const original = descriptor.value!
    descriptor.value = async function (...args: TArgs) {
      const result = await original.apply(this, args)

      const topic = resolve(opts.topic, args)
      const type = resolve(opts.type, args)
      const data = opts.data !== undefined ? resolve(opts.data, args) : result
      const options = (opts.options ? resolve(opts.options, args) : undefined) as PublishOptions

      const bus = MessageBusService.getInstance()
      if (!bus) return result

      const envelope: MessageEnvelope<any> = {
        topic,
        type,
        data,
        meta: { timestamp: new Date().toISOString(), correlationId: options?.correlationId },
      }

      const mode = (options?.mode || MessageBusService.getDefaultMode()) as
        | 'volatile'
        | 'reliable'
        | 'handshake'
      if (mode === 'reliable') {
        const outbox = (OutboxService as any).getInstance?.() as OutboxService | undefined
        if (outbox)
          await outbox.record(envelope, {
            dedupeKey: options?.dedupeKey,
            priority: options?.priority,
          })
        else {
          // 初始化未完成时降级为 volatile，并给出显式日志提示
          const svc = MessageBusService.getInstance() as any
          svc?.logger?.warn?.(
            'OutboxService not initialized; fallback to volatile publish from @EmitOutbox',
          )
          await bus.publish(topic, type, data, options)
        }
      } else if (mode === 'handshake') {
        await bus.publishAndWait(topic, type, data, options as any)
      } else {
        await bus.publish(topic, type, data, options)
      }

      return result
    }
    return descriptor
  }
}

export function EmitOutbox<TArgs extends any[] = any[]>(
  opts: Omit<PublishDecoratorOptions<TArgs>, 'options'> & {
    options?: ValueOrFn<TArgs, Omit<PublishOptions, 'mode'>>
  },
) {
  return Publish<TArgs>({
    ...opts,
    options: ((...args: TArgs) => ({
      ...(opts.options ? resolve(opts.options, args) : {}),
      mode: 'reliable' as const,
    })) as any,
  })
}
