import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../../domain/models/whale_holding_models.dart';
import '../repositories/whale_holdings_repository.dart';
import '../services/generated_backend_api.dart';

/// [WhaleHoldingsRepository] 真实现（issue #2189 / 持仓契约接入）。
///
/// 走 generated `/whale-holdings` 契约拉持仓明细。后端返回空列表时保持真实
/// 空态，不回退 mock fixture。
class ApiWhaleHoldingsRepository implements WhaleHoldingsRepository {
  ApiWhaleHoldingsRepository(this._api);

  static const num _minPositionValueUsd = 1000000;
  static const num _limit = 200;

  final GeneratedBackendApi _api;

  WhaleHoldingSide _side(WhaleHoldingDtoSideEnum side) {
    return side == WhaleHoldingDtoSideEnum.SHORT
        ? WhaleHoldingSide.short
        : WhaleHoldingSide.long;
  }

  WhaleHoldingPosition _map(WhaleHoldingDto dto) {
    final double value = dto.positionValueUsd.toDouble();
    final double margin = value / (dto.leverage?.toDouble() ?? 10);
    final double pnl = dto.pnl?.toDouble() ?? 0;
    final double roe = dto.roe?.toDouble() ?? 0;
    final double? liq = dto.liquidationPrice?.toDouble();
    final int hoursAgo = _hoursAgo(dto.snapshotTime);

    return WhaleHoldingPosition(
      address: dto.userAddress,
      symbol: dto.symbol,
      symbolColorHex: _symbolColor(dto.symbol),
      mode: 'Cross',
      side: _side(dto.side),
      leverage: dto.leverage?.round() ?? 0,
      value: value,
      valueDisplay: _formatUsdCompact(value),
      qtyDisplay: '${dto.positionSize.toDouble().toStringAsFixed(4)} ${dto.symbol}',
      pnl: pnl,
      pnlDisplay: _formatUsdCompact(pnl, signed: true),
      pnlPctDisplay: _formatPercent(roe),
      margin: margin,
      marginDisplay: _formatUsdCompact(margin),
      openDisplay: _formatUsdPrice(dto.entryPrice.toDouble()),
      liqDisplay: liq == null ? '--' : _formatUsdPrice(liq),
      liqBreached: false,
      hoursAgo: hoursAgo,
      timeDisplay: _formatHoursAgo(hoursAgo),
    );
  }

  @override
  Future<List<WhaleHoldingPosition>> getHoldings() async {
    final response = await _api.client
        .getDefaultApi()
        .whaleHoldingsControllerGetWhaleHoldings(
          page: 1,
          limit: _limit,
          minPositionValueUsd: _minPositionValueUsd,
        );

    final Iterable<dynamic> items = response.data?.items ?? const <dynamic>[];
    return items
        .map(_decodeDto)
        .whereType<WhaleHoldingDto>()
        .map(_map)
        .toList(growable: false);
  }

  WhaleHoldingDto? _decodeDto(dynamic raw) {
    final Object? value = raw.value;
    if (value is WhaleHoldingDto) return value;
    if (value is! Map) return null;
    return _api.client.serializers.deserializeWith(
      WhaleHoldingDto.serializer,
      value,
    );
  }

  static int _hoursAgo(String iso) {
    final DateTime? snapshot = DateTime.tryParse(iso);
    if (snapshot == null) return 0;
    final Duration diff = DateTime.now().toUtc().difference(snapshot.toUtc());
    if (diff.isNegative) return 0;
    return diff.inHours;
  }

  static String _formatHoursAgo(int hours) {
    if (hours <= 0) return '刚刚';
    return '$hours 小时前';
  }

  static String _formatPercent(double value) {
    final String sign = value >= 0 ? '+' : '-';
    return '$sign${(value.abs() * 100).toStringAsFixed(2)}%';
  }

  static String _formatUsdCompact(double value, {bool signed = false}) {
    final double abs = value.abs();
    final String sign = signed && value >= 0
        ? '+'
        : value < 0
        ? '-'
        : '';
    final ({double divisor, String suffix}) unit = switch (abs) {
      >= 1000000000 => (divisor: 1000000000, suffix: 'B'),
      >= 1000000 => (divisor: 1000000, suffix: 'M'),
      >= 1000 => (divisor: 1000, suffix: 'K'),
      _ => (divisor: 1, suffix: ''),
    };
    return '$sign\$${(abs / unit.divisor).toStringAsFixed(2)}${unit.suffix}';
  }

  static String _formatUsdPrice(double value) {
    final String fixed = value.toStringAsFixed(2);
    final List<String> parts = fixed.split('.');
    final String whole = parts[0];
    final StringBuffer buf = StringBuffer();
    for (int i = 0; i < whole.length; i += 1) {
      if (i > 0 && (whole.length - i) % 3 == 0) buf.write(',');
      buf.write(whole[i]);
    }
    return '\$${buf.toString()}.${parts[1]}';
  }

  static int _symbolColor(String symbol) {
    return switch (symbol.toUpperCase()) {
      'BTC' => 0xFFF7931A,
      'ETH' => 0xFF627EEA,
      'SOL' => 0xFF14F195,
      'HYPE' => 0xFF50D5C8,
      _ => 0xFF888888,
    };
  }
}
