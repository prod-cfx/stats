import '../../models/strategy_models.dart';

const List<StrategyCard> mockFeaturedStrategies = <StrategyCard>[
  StrategyCard(
    id: 'st-grid-btc',
    name: 'BTC 网格搬砖',
    description: '基础网格策略，适合震荡行情。',
    pnlPercent: 12.4,
    subscribers: 320,
    tags: <String>['grid', 'BTCUSDT'],
  ),
  StrategyCard(
    id: 'st-trend-eth',
    name: 'ETH 趋势跟随',
    description: '基于均线突破的趋势跟随策略。',
    pnlPercent: 8.7,
    subscribers: 215,
    tags: <String>['trend', 'ETHUSDT'],
  ),
  StrategyCard(
    id: 'st-dca-sol',
    name: 'SOL 定投',
    description: '固定周期定额买入，长期持仓。',
    pnlPercent: 22.3,
    subscribers: 540,
    tags: <String>['dca', 'SOLUSDT'],
  ),
  StrategyCard(
    id: 'st-arb-stable',
    name: '稳定币套利',
    description: '跨交易所稳定币价差套利。',
    pnlPercent: 3.1,
    subscribers: 98,
    tags: <String>['arbitrage', 'stable'],
  ),
];

const List<StrategyCard> mockMyStrategies = <StrategyCard>[
  StrategyCard(
    id: 'st-mine-1',
    name: '我的高频网格',
    description: '自建的高频小网格。',
    pnlPercent: -1.5,
    subscribers: 1,
    tags: <String>['grid', 'mine'],
  ),
  StrategyCard(
    id: 'st-mine-2',
    name: '我的动量突破',
    description: '基于布林带突破的动量策略。',
    pnlPercent: 5.8,
    subscribers: 1,
    tags: <String>['momentum', 'mine'],
  ),
];
