/**
 * Issue #1279 PR3c.7a — pure leak-guard helper（无 NestJS DI）。
 *
 * 现有 `internal-key-leak-guard.ts` 暴露的 `InternalKeyLeakGuardService` 仍保留供
 * scan-mode 调用方使用；本文件仅提供"单条公开文本 fail-loud 校验"的无依赖入口，
 * 给后续 `legacy-presentation-data.ts`（原 semantic-presentation-registry.service.ts）
 * 在 transition 期内仍能调用 atomRegistry 驱动的 internal-key 兜底检测。
 *
 * module load 时立即构造（fail-loud）：
 *   - 避免 lazy init 在 first-call 失败后 cachedPattern 仍为 undefined → 静默重试
 *   - 避免 Jest 多文件并行时 module 级变量跨测试污染（无共享 mutable state）
 */
import { InternalKeyLeakDetectedException } from '../../exceptions/internal-key-leak.exception'
import { SemanticAtomRegistryService } from '../../services/semantic-atom-registry.service'
import {
  buildInternalIdentifierKeys,
  buildInternalIdentifierPattern,
} from './internal-key-identifiers'

const LEAK_PATTERN: RegExp = (() => {
  const atomRegistry = new SemanticAtomRegistryService()
  return buildInternalIdentifierPattern(buildInternalIdentifierKeys(atomRegistry))
})()

/**
 * 仅供 Jest 隔离使用：返回当前 pattern 实例（module-load 时构造，不可变）。
 * 本函数不可变更全局 pattern，仅为 spec 提供白盒访问路径。
 */
export function __getPatternForTests(): RegExp {
  return LEAK_PATTERN
}

/**
 * 对单条公开文本做 internal-key 泄漏检测，命中即 throw `InternalKeyLeakDetectedException`。
 * 与 `InternalKeyLeakGuardService.scan` 不同：本 helper 只面向"已经渲染出的字符串文案"，
 * 不做对象/数组递归，调用方在 render 出口直接 pipe。
 */
export function guardPublicText(key: string, output: string): string {
  if (LEAK_PATTERN.test(output)) {
    throw new InternalKeyLeakDetectedException({
      key,
      details: `semantic_presentation_internal_key_leak:${key}`,
    })
  }
  return output
}
