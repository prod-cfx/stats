import 'package:quantify_mobile/data/models/api_key_models.dart';

final List<ExchangeApiKey> mockApiKeys = <ExchangeApiKey>[
  ExchangeApiKey(
    id: 'key-1',
    exchange: 'binance',
    label: '主账户',
    maskedKey: 'AKIA****1234',
    createdAt: DateTime.fromMillisecondsSinceEpoch(1_715_000_000_000),
  ),
  ExchangeApiKey(
    id: 'key-2',
    exchange: 'okx',
    label: '测试子账户',
    maskedKey: 'OKX-****5678',
    isTestnet: true,
    createdAt: DateTime.fromMillisecondsSinceEpoch(1_715_500_000_000),
  ),
  ExchangeApiKey(
    id: 'key-3',
    exchange: 'hyperliquid',
    label: '测试钱包',
    maskedKey: '0x12****abcd',
    isTestnet: true,
    createdAt: DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000),
  ),
];
