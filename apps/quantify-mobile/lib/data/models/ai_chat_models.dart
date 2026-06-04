/// AI 聊天会话相关模型（#1557 多会话）。
library;

/// `ChatTurn` 渲染类型。
///
/// - `text` ：普通文本气泡（默认）
/// - `params`：策略参数代码块（如 `fast_ma=5 / slow_ma=20`）
/// - `result`：嵌入回测结果卡片（占位，UI 侧组合 `BacktestSummary` 渲染）
/// - `deployed`：部署终态富气泡（部署成功后写入；UI 侧渲染实例信息）
enum ChatTurnKind { text, params, result, deployed }

class ChatTurn {
  final String id;
  final String role; // 'user' | 'assistant' | 'system'
  final String content;
  final DateTime timestamp;
  final ChatTurnKind kind;

  /// 当 `kind == ChatTurnKind.params` 时携带的策略参数键值对。
  /// 渲染层按等宽字体逐行展示；其它 kind 下应为 null。
  final Map<String, String>? params;

  /// 当 `kind == ChatTurnKind.deployed` 时携带的部署目标交易所展示名
  /// （如 `Binance`）与实例 ID，供部署终态富气泡的 header / subline 渲染。
  /// 其它 kind 下应为 null。
  final String? deployedExchange;
  final String? deployedInstanceId;

  const ChatTurn({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.kind = ChatTurnKind.text,
    this.params,
    this.deployedExchange,
    this.deployedInstanceId,
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
/// - `cagrLabel`：回测年化标签（"+31.6%"）；当前抽屉列表不渲染
/// - `updatedAt`：用于排序与抽屉副本"刚刚 / 昨天 / 3 天前"
/// - `messages`：会话内消息序列
/// - `deployedTo`：已部署到的实例 ID；null 表示未部署。参数卡锁定态与部署终态
///   富气泡均依赖此字段判断「是否已部署」（对齐原型 m-screens-1.jsx
///   `locked = !!current.deployedTo`）
class AiSession {
  final String id;
  final String title;
  final String category;
  final String? pair;
  final String? timeframe;
  final String? cagrLabel;
  final DateTime updatedAt;
  final List<ChatTurn> messages;
  final String? deployedTo;

  const AiSession({
    required this.id,
    required this.title,
    required this.category,
    required this.updatedAt,
    required this.messages,
    this.pair,
    this.timeframe,
    this.cagrLabel,
    this.deployedTo,
  });

  AiSession copyWith({
    String? title,
    String? category,
    String? pair,
    String? timeframe,
    String? cagrLabel,
    DateTime? updatedAt,
    List<ChatTurn>? messages,
    String? deployedTo,
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
      deployedTo: deployedTo ?? this.deployedTo,
    );
  }
}
