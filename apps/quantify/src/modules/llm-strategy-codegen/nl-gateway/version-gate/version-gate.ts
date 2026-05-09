import { AtomVersionGateValidationFailedException } from '../../exceptions/atom-version-gate-validation-failed.exception'
import type { StrategyVersionInfo, VersionedAtomContract } from './version-gate.types'

/**
 * 当前语义版本
 * 格式：YYYY.MM.WNN（零填充周序号）
 */
export const CURRENT_SEMANTIC_VERSION = '2026.05.W02'

/**
 * 语义版本格式正则：YYYY.MM.WNN（年.月.W周，周序号零填充）
 */
const SEMANTIC_VERSION_PATTERN = /^\d{4}\.\d{2}\.W\d{2}$/

/**
 * 校验语义版本格式
 * @throws AtomVersionGateValidationFailedException 格式不符时抛出
 */
export function validateSemanticVersion(version: string): void {
  if (!SEMANTIC_VERSION_PATTERN.test(version)) {
    throw new AtomVersionGateValidationFailedException({
      version,
      reason: `must match format YYYY.MM.WNN (e.g. 2026.05.W02)`,
    })
  }
}

/**
 * 比较两个语义版本的大小
 * 格式：YYYY.MM.WNN（字典序即时间序，零填充保证正确）
 * @returns 负数: a < b, 0: a === b, 正数: a > b
 * @throws AtomVersionGateValidationFailedException 任一格式不合规时抛出
 */
export function compareSemanticVersion(a: string, b: string): number {
  validateSemanticVersion(a)
  validateSemanticVersion(b)
  // 格式 YYYY.MM.WNN 在零填充后字典序 === 时间序
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

/**
 * 判断 atom 对某策略实例是否应使用新行为
 *
 * 返回 false 的情况：
 * - contract.executableSinceVersion 未声明（atom 未翻牌）
 * - strategy.deployedAtSemanticVersion 为 null（老策略，部署时无版本记录）
 * - 策略部署版本 < atom 声明的翻牌版本
 *
 * 返回 true 的情况：
 * - 策略部署版本 >= atom 声明的翻牌版本
 */
export function isAtomExecutableForStrategy(
  contract: VersionedAtomContract,
  strategy: StrategyVersionInfo,
): boolean {
  if (contract.executableSinceVersion === undefined) {
    return false
  }
  if (strategy.deployedAtSemanticVersion === null) {
    return false
  }
  return compareSemanticVersion(strategy.deployedAtSemanticVersion, contract.executableSinceVersion) >= 0
}
