import '../../models/ai_chat_models.dart';

final List<ChatTurn> mockChatTurns = <ChatTurn>[
  ChatTurn(
    id: 'turn-1',
    role: 'user',
    content: '帮我做一个 BTC 趋势策略',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000),
  ),
  ChatTurn(
    id: 'turn-2',
    role: 'assistant',
    content: '好的，已生成基于 EMA20/60 的趋势策略草稿，正在跑回测。',
    timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_001_000),
  ),
];

const BacktestSummary mockLatestBacktestSummary = BacktestSummary(
  id: 'bt-mock-1',
  totalReturnPercent: 18.2,
  maxDrawdownPercent: -7.5,
  trades: 42,
);
