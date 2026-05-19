/// AI 聊天会话相关模型（#1557 多会话）。
library;

/// `ChatTurn` 渲染类型。
///
/// - `text` ：普通文本气泡（默认）
/// - `params`：策略参数代码块（如 `fast_ma=5 / slow_ma=20`）
/// - `result`：嵌入回测结果卡片（占位，UI 侧组合 `BacktestSummary` 渲染）
enum ChatTurnKind { text, params, result }

class ChatTurn {
  final String id;
  final String role; // 'user' | 'assistant' | 'system'
  final String content;
  final DateTime timestamp;
  final ChatTurnKind kind;

  /// 当 `kind == ChatTurnKind.params` 时携带的策略参数键值对。
  /// 渲染层按等宽字体逐行展示；其它 kind 下应为 null。
  final Map<String, String>? params;

  const ChatTurn({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.kind = ChatTurnKind.text,
    this.params,
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

/// AI 多会话 — 单个会话的元数据 + 消息序列。
///
/// 字段对齐原型 `design/project/mobile/m-screens-1.jsx::__qfChatSessions`：
/// - `title`：用户可见的会话标题（"BTC 趋势 · 双均线"）
/// - `category`：抽屉副标题分类（"趋势跟踪" / "反转" / "网格" / "未分类"）
/// - `pair / timeframe`：可选元数据，渲染在顶栏副标题
/// - `cagrLabel`：抽屉右上角的回测年化标签（"+31.6%"）；null 表示未跑回测
/// - `updatedAt`：用于排序与抽屉副本"刚刚 / 昨天 / 3 天前"
/// - `messages`：会话内消息序列
class AiSession {
  final String id;
  final String title;
  final String category;
  final String? pair;
  final String? timeframe;
  final String? cagrLabel;
  final DateTime updatedAt;
  final List<ChatTurn> messages;

  const AiSession({
    required this.id,
    required this.title,
    required this.category,
    required this.updatedAt,
    required this.messages,
    this.pair,
    this.timeframe,
    this.cagrLabel,
  });

  AiSession copyWith({
    String? title,
    String? category,
    String? pair,
    String? timeframe,
    String? cagrLabel,
    DateTime? updatedAt,
    List<ChatTurn>? messages,
  }) {
    return AiSession(
      id: id,
      title: title ?? this.title,
      category: category ?? this.category,
      pair: pair ?? this.pair,
      timeframe: timeframe ?? this.timeframe,
      cagrLabel: cagrLabel ?? this.cagrLabel,
      updatedAt: updatedAt ?? this.updatedAt,
      messages: messages ?? this.messages,
    );
  }
}
