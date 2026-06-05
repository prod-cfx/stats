// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_asset_performance_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleAssetPerformanceDto extends WhaleAssetPerformanceDto {
  @override
  final String symbol;
  @override
  final num totalValueUsd;
  @override
  final num trades;
  @override
  final num longCount;
  @override
  final num shortCount;

  factory _$WhaleAssetPerformanceDto([
    void Function(WhaleAssetPerformanceDtoBuilder)? updates,
  ]) => (WhaleAssetPerformanceDtoBuilder()..update(updates))._build();

  _$WhaleAssetPerformanceDto._({
    required this.symbol,
    required this.totalValueUsd,
    required this.trades,
    required this.longCount,
    required this.shortCount,
  }) : super._();
  @override
  WhaleAssetPerformanceDto rebuild(
    void Function(WhaleAssetPerformanceDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleAssetPerformanceDtoBuilder toBuilder() =>
      WhaleAssetPerformanceDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleAssetPerformanceDto &&
        symbol == other.symbol &&
        totalValueUsd == other.totalValueUsd &&
        trades == other.trades &&
        longCount == other.longCount &&
        shortCount == other.shortCount;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, totalValueUsd.hashCode);
    _$hash = $jc(_$hash, trades.hashCode);
    _$hash = $jc(_$hash, longCount.hashCode);
    _$hash = $jc(_$hash, shortCount.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleAssetPerformanceDto')
          ..add('symbol', symbol)
          ..add('totalValueUsd', totalValueUsd)
          ..add('trades', trades)
          ..add('longCount', longCount)
          ..add('shortCount', shortCount))
        .toString();
  }
}

class WhaleAssetPerformanceDtoBuilder
    implements
        Builder<WhaleAssetPerformanceDto, WhaleAssetPerformanceDtoBuilder> {
  _$WhaleAssetPerformanceDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  num? _totalValueUsd;
  num? get totalValueUsd => _$this._totalValueUsd;
  set totalValueUsd(num? totalValueUsd) =>
      _$this._totalValueUsd = totalValueUsd;

  num? _trades;
  num? get trades => _$this._trades;
  set trades(num? trades) => _$this._trades = trades;

  num? _longCount;
  num? get longCount => _$this._longCount;
  set longCount(num? longCount) => _$this._longCount = longCount;

  num? _shortCount;
  num? get shortCount => _$this._shortCount;
  set shortCount(num? shortCount) => _$this._shortCount = shortCount;

  WhaleAssetPerformanceDtoBuilder() {
    WhaleAssetPerformanceDto._defaults(this);
  }

  WhaleAssetPerformanceDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _totalValueUsd = $v.totalValueUsd;
      _trades = $v.trades;
      _longCount = $v.longCount;
      _shortCount = $v.shortCount;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleAssetPerformanceDto other) {
    _$v = other as _$WhaleAssetPerformanceDto;
  }

  @override
  void update(void Function(WhaleAssetPerformanceDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleAssetPerformanceDto build() => _build();

  _$WhaleAssetPerformanceDto _build() {
    final _$result =
        _$v ??
        _$WhaleAssetPerformanceDto._(
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'WhaleAssetPerformanceDto',
            'symbol',
          ),
          totalValueUsd: BuiltValueNullFieldError.checkNotNull(
            totalValueUsd,
            r'WhaleAssetPerformanceDto',
            'totalValueUsd',
          ),
          trades: BuiltValueNullFieldError.checkNotNull(
            trades,
            r'WhaleAssetPerformanceDto',
            'trades',
          ),
          longCount: BuiltValueNullFieldError.checkNotNull(
            longCount,
            r'WhaleAssetPerformanceDto',
            'longCount',
          ),
          shortCount: BuiltValueNullFieldError.checkNotNull(
            shortCount,
            r'WhaleAssetPerformanceDto',
            'shortCount',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
