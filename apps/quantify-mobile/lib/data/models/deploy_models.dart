/// AI 对话「一键部署」相关模型。
///
/// 仅 UI 侧使用，后端尚未接入。当前由 `QzDeploySheet` 用 mock 计时驱动
/// `pickExchange → authorize → deploying → done` 状态流。
enum DeployStep {
  pickExchange,
  authorize,
  deploying,
  done,
}

/// 部署成功后回传给调用方（AI 对话页）的轻量结果。
///
/// 字段刻意只保留对话气泡需要展示的最小集合：交易所名 + 实例 ID + 时间。
/// 后端接入后再加 strategyId / config 快照等字段时不会破坏现有调用方。
class DeploymentResult {
  final String exchange;
  final String instanceId;
  final DateTime deployedAt;

  const DeploymentResult({
    required this.exchange,
    required this.instanceId,
    required this.deployedAt,
  });
}
