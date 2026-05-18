/// 交易所 API Key。
class ExchangeApiKey {
  final String id;
  final String exchange;
  final String label;
  final String maskedKey;
  final DateTime createdAt;

  const ExchangeApiKey({
    required this.id,
    required this.exchange,
    required this.label,
    required this.maskedKey,
    required this.createdAt,
  });
}
