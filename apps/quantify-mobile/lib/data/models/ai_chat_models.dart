/// AI 聊天会话相关模型。
class ChatTurn {
  final String id;
  final String role; // 'user' | 'assistant'
  final String content;
  final DateTime timestamp;

  const ChatTurn({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
  });
}

/// 聊天卡片用的轻量回测摘要；与完整 `BacktestResult` 区分。
///
/// Summary 可由 Result 投影得到；二者独立持久化以避免聊天历史拉宽（聊天历史
/// 仅嵌入 Summary 字段，完整 Result 通过 `BacktestRepository.getResult(id)` 按需取）。
class BacktestSummary {
  final String id;
  final double totalReturnPercent;
  final double maxDrawdownPercent;
  final int trades;

  const BacktestSummary({
    required this.id,
    required this.totalReturnPercent,
    required this.maxDrawdownPercent,
    required this.trades,
  });
}
