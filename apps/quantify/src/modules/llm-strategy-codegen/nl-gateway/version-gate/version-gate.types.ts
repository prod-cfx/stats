/**
 * Atom 翻牌版本合约接口
 * executableSinceVersion: 声明该 atom 的新行为从哪个语义版本起生效
 * 格式：YYYY.MM.WNN（零填充周序号），如 2026.05.W02
 */
export interface VersionedAtomContract {
  executableSinceVersion?: string
}

/**
 * 策略实例的版本信息（用于 version-gate 判断）
 * deployedAtSemanticVersion: 策略实例部署时的语义版本，null 表示老策略（部署时无版本记录）
 */
export interface StrategyVersionInfo {
  deployedAtSemanticVersion: string | null
}
