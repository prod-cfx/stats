import '../../models/ai_chat_models.dart';

/// AI 助手欢迎语；新会话默认插入这一条。
const String mockGreeting = '告诉我你的交易想法，我会帮你生成策略并回测。回测最大回撤需 ≤ 20% 才能一键部署。';

/// 默认 mock 会话（对齐原型 `__qfChatSessions`）：BTC 实盘 / ETH / SOL /
/// AVAX 待部署。
List<AiSession> buildMockSessions() {
  return <AiSession>[
    AiSession(
      id: 's5',
      title: 'AVAX 突破 · 待部署',
      category: '突破',
      pair: 'AVAX/USDT',
      timeframe: '1H',
      cagrLabel: null,
      updatedAt: DateTime.fromMillisecondsSinceEpoch(1_716_000_240_000),
      messages: <ChatTurn>[
        ChatTurn(
          id: 's5-greet',
          role: 'assistant',
          content: mockGreeting,
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_200_000),
        ),
        ChatTurn(
          id: 's5-1',
          role: 'user',
          content: 'AVAX 1 小时，突破前 20 根 K 线高点开多，跌破 ATR 止损。',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_205_000),
        ),
        ChatTurn(
          id: 's5-2',
          role: 'assistant',
          content: '已识别为 突破跟踪。建议加上「成交量过滤」减少假突破。',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_210_000),
        ),
        ChatTurn(
          id: 's5-3',
          role: 'assistant',
          content: '',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_215_000),
          kind: ChatTurnKind.params,
          params: <String, String>{
            'category': '趋势跟踪',
            'fast_ma': '5',
            'slow_ma': '20',
            'stop_loss': '2.0%',
            'position': '100%',
          },
        ),
      ],
    ),
    AiSession(
      id: 's1',
      title: 'BTC 趋势 · 双均线',
      category: '趋势跟踪',
      pair: 'BTC/USDT',
      timeframe: '15m',
      cagrLabel: '+31.6%',
      deployedTo: 'QF-AY7K2P',
      updatedAt: DateTime.fromMillisecondsSinceEpoch(1_716_000_120_000),
      messages: <ChatTurn>[
        ChatTurn(
          id: 's1-greet',
          role: 'assistant',
          content: mockGreeting,
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000),
        ),
        ChatTurn(
          id: 's1-1',
          role: 'user',
          content: 'BTC 15 分钟周期，5 日均线上穿 20 日均线开多，跌破平仓，止损 2%。',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_001_000),
        ),
        ChatTurn(
          id: 's1-2',
          role: 'assistant',
          content: '已为你识别为「趋势跟踪」策略，建议参数：',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_002_000),
          kind: ChatTurnKind.params,
          params: <String, String>{
            'symbol': 'BTC/USDT',
            'period': '15m',
            'fast_ma': '5',
            'slow_ma': '20',
            'stop_loss': '2.0%',
            'leverage': '5x',
          },
        ),
        ChatTurn(
          id: 's1-deployed',
          role: 'assistant',
          content: '策略已部署到 Binance',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_120_000),
          kind: ChatTurnKind.deployed,
          deployedExchange: 'Binance',
          deployedInstanceId: 'QF-AY7K2P',
        ),
      ],
    ),
    AiSession(
      id: 's2',
      title: 'ETH 4H 均值回归',
      category: '反转',
      pair: 'ETH/USDT',
      timeframe: '4H',
      cagrLabel: '+18.2%',
      updatedAt: DateTime.fromMillisecondsSinceEpoch(1_715_900_000_000),
      messages: <ChatTurn>[
        ChatTurn(
          id: 's2-greet',
          role: 'assistant',
          content: mockGreeting,
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_715_899_000_000),
        ),
        ChatTurn(
          id: 's2-1',
          role: 'user',
          content: 'ETH 4 小时 RSI 低于 30 开多，回到 50 平仓，止损 3%。',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_715_899_500_000),
        ),
        ChatTurn(
          id: 's2-2',
          role: 'assistant',
          content: '已识别为「均值回归」策略；初步回测 CAGR +18.2% · 最大回撤 -9.1%。',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_715_900_000_000),
        ),
      ],
    ),
    AiSession(
      id: 's3',
      title: 'SOL 网格 · 区间震荡',
      category: '网格',
      pair: 'SOL/USDT',
      timeframe: '1H',
      cagrLabel: null,
      updatedAt: DateTime.fromMillisecondsSinceEpoch(1_715_700_000_000),
      messages: <ChatTurn>[
        ChatTurn(
          id: 's3-greet',
          role: 'assistant',
          content: mockGreeting,
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_715_700_000_000),
        ),
        ChatTurn(
          id: 's3-1',
          role: 'user',
          content: 'SOL 1 小时，140-180 区间内做网格，10 格。',
          timestamp: DateTime.fromMillisecondsSinceEpoch(1_715_700_500_000),
        ),
      ],
    ),
  ];
}

const BacktestSummary mockLatestBacktestSummary = BacktestSummary(
  id: 'bt-mock-1',
  totalReturnPercent: 18.2,
  maxDrawdownPercent: -7.5,
  trades: 42,
);
