/// AI 对话「一键部署」相关模型。
enum DeployStep { confirm, deploying, success }

/// 一键部署必须由调用方传入的真实上下文。
class DeploymentContext {
  const DeploymentContext({
    required this.sessionId,
    required this.publishedSnapshotId,
    required this.amount,
    required this.perTradePct,
    required this.maxDailyLossPct,
    required this.notifyOpen,
    required this.notifyClose,
    required this.notifyStopLoss,
    this.exchangeAccountId,
    this.symbol,
    this.strategyName,
    this.backtestReturn,
    this.backtestSharpe,
    this.backtestMaxDrawdown,
  });

  final String sessionId;
  final String publishedSnapshotId;
  final String? exchangeAccountId;
  final double amount;
  final int perTradePct;
  final int maxDailyLossPct;
  final bool notifyOpen;
  final bool notifyClose;
  final bool notifyStopLoss;
  final String? symbol;
  final String? strategyName;
  final double? backtestReturn;
  final double? backtestSharpe;
  final double? backtestMaxDrawdown;

  Map<String, Object?> toExecutionConfig({String? exchangeAccountId}) {
    final Map<String, Object?> config = <String, Object?>{
      'amount': amount,
      'perTradePct': perTradePct,
      'maxDailyLossPct': maxDailyLossPct,
      'notifyOpen': notifyOpen,
      'notifyClose': notifyClose,
      'notifyStopLoss': notifyStopLoss,
    };
    if (exchangeAccountId != null) {
      config['exchangeAccountId'] = exchangeAccountId;
    }
    return config;
  }
}

/// 部署前预检结果。
class DeployPreflightResult {
  const DeployPreflightResult({
    required this.apiConnected,
    required this.balanceReady,
    required this.latencyReady,
  });

  const DeployPreflightResult.failed()
    : apiConnected = false,
      balanceReady = false,
      latencyReady = false;

  final bool apiConnected;
  final bool balanceReady;
  final bool latencyReady;
}

/// 资金配置（#1772 DpAllocate）。
///
/// 全部为部署上下文输入；真实部署由后端校验。
class DeployAllocation {
  final double amount; // 投入金额（USDT）
  final int perTradePct; // 单笔仓位上限（%）
  final int maxDailyLossPct; // 日内最大亏损（%）
  final bool notify; // 通知渠道开关

  const DeployAllocation({
    required this.amount,
    required this.perTradePct,
    required this.maxDailyLossPct,
    required this.notify,
  });
}

/// 部署前预检查项（#1772 PreflightChecks）。
///
/// `ok=false` 表示该项未通过；`actionable` 标记是否带「去处理」动作。
class PreflightCheck {
  final bool ok;
  final String title;
  final String sub;
  final bool actionable;

  const PreflightCheck({
    required this.ok,
    required this.title,
    required this.sub,
    this.actionable = false,
  });
}

/// 部署中分步任务（#1772 DpDeploying）。
class DeployingStep {
  final String label;
  final String sub;

  const DeployingStep({required this.label, required this.sub});
}

/// 部署成功后回传给调用方（AI 对话页）的结果。
///
/// 现有三个字段（`exchange` / `instanceId` / `deployedAt`）保持 required 不变，
/// 调用方 `ai_home_page.dart` 零破坏。#1772 追加的快照字段全部 nullable：
/// 真实部署接入前由 mock 资金配置回填，仅供成功详情卡展示。
class DeploymentResult {
  final String exchange;
  final String instanceId;
  final DateTime deployedAt;

  // #1772：成功详情卡快照（nullable，向后兼容）。
  final String? strategyId;
  final String? symbol;
  final double? amount;
  final String? leverage;
  // #1896：启动时间（对齐设计稿 ScreenDeploy success 受理；nullable 向后兼容）。
  final DateTime? startedAt;

  const DeploymentResult({
    required this.exchange,
    required this.instanceId,
    required this.deployedAt,
    this.strategyId,
    this.symbol,
    this.amount,
    this.leverage,
    this.startedAt,
  });
}
