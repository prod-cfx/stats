// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_trader_summary_performance_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleTraderSummaryPerformanceDto
    extends WhaleTraderSummaryPerformanceDto {
  @override
  final String address;
  @override
  final num lookbackDays;
  @override
  final String? symbolFilter;
  @override
  final num trades;
  @override
  final num positions;
  @override
  final num totalValueUsd;
  @override
  final num longCount;
  @override
  final num shortCount;
  @override
  final num winRatePct;
  @override
  final num pnlUsd;

  factory _$WhaleTraderSummaryPerformanceDto([
    void Function(WhaleTraderSummaryPerformanceDtoBuilder)? updates,
  ]) => (WhaleTraderSummaryPerformanceDtoBuilder()..update(updates))._build();

  _$WhaleTraderSummaryPerformanceDto._({
    required this.address,
    required this.lookbackDays,
    this.symbolFilter,
    required this.trades,
    required this.positions,
    required this.totalValueUsd,
    required this.longCount,
    required this.shortCount,
    required this.winRatePct,
    required this.pnlUsd,
  }) : super._();
  @override
  WhaleTraderSummaryPerformanceDto rebuild(
    void Function(WhaleTraderSummaryPerformanceDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleTraderSummaryPerformanceDtoBuilder toBuilder() =>
      WhaleTraderSummaryPerformanceDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleTraderSummaryPerformanceDto &&
        address == other.address &&
        lookbackDays == other.lookbackDays &&
        symbolFilter == other.symbolFilter &&
        trades == other.trades &&
        positions == other.positions &&
        totalValueUsd == other.totalValueUsd &&
        longCount == other.longCount &&
        shortCount == other.shortCount &&
        winRatePct == other.winRatePct &&
        pnlUsd == other.pnlUsd;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, address.hashCode);
    _$hash = $jc(_$hash, lookbackDays.hashCode);
    _$hash = $jc(_$hash, symbolFilter.hashCode);
    _$hash = $jc(_$hash, trades.hashCode);
    _$hash = $jc(_$hash, positions.hashCode);
    _$hash = $jc(_$hash, totalValueUsd.hashCode);
    _$hash = $jc(_$hash, longCount.hashCode);
    _$hash = $jc(_$hash, shortCount.hashCode);
    _$hash = $jc(_$hash, winRatePct.hashCode);
    _$hash = $jc(_$hash, pnlUsd.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleTraderSummaryPerformanceDto')
          ..add('address', address)
          ..add('lookbackDays', lookbackDays)
          ..add('symbolFilter', symbolFilter)
          ..add('trades', trades)
          ..add('positions', positions)
          ..add('totalValueUsd', totalValueUsd)
          ..add('longCount', longCount)
          ..add('shortCount', shortCount)
          ..add('winRatePct', winRatePct)
          ..add('pnlUsd', pnlUsd))
        .toString();
  }
}

class WhaleTraderSummaryPerformanceDtoBuilder
    implements
        Builder<
          WhaleTraderSummaryPerformanceDto,
          WhaleTraderSummaryPerformanceDtoBuilder
        > {
  _$WhaleTraderSummaryPerformanceDto? _$v;

  String? _address;
  String? get address => _$this._address;
  set address(String? address) => _$this._address = address;

  num? _lookbackDays;
  num? get lookbackDays => _$this._lookbackDays;
  set lookbackDays(num? lookbackDays) => _$this._lookbackDays = lookbackDays;

  String? _symbolFilter;
  String? get symbolFilter => _$this._symbolFilter;
  set symbolFilter(String? symbolFilter) => _$this._symbolFilter = symbolFilter;

  num? _trades;
  num? get trades => _$this._trades;
  set trades(num? trades) => _$this._trades = trades;

  num? _positions;
  num? get positions => _$this._positions;
  set positions(num? positions) => _$this._positions = positions;

  num? _totalValueUsd;
  num? get totalValueUsd => _$this._totalValueUsd;
  set totalValueUsd(num? totalValueUsd) =>
      _$this._totalValueUsd = totalValueUsd;

  num? _longCount;
  num? get longCount => _$this._longCount;
  set longCount(num? longCount) => _$this._longCount = longCount;

  num? _shortCount;
  num? get shortCount => _$this._shortCount;
  set shortCount(num? shortCount) => _$this._shortCount = shortCount;

  num? _winRatePct;
  num? get winRatePct => _$this._winRatePct;
  set winRatePct(num? winRatePct) => _$this._winRatePct = winRatePct;

  num? _pnlUsd;
  num? get pnlUsd => _$this._pnlUsd;
  set pnlUsd(num? pnlUsd) => _$this._pnlUsd = pnlUsd;

  WhaleTraderSummaryPerformanceDtoBuilder() {
    WhaleTraderSummaryPerformanceDto._defaults(this);
  }

  WhaleTraderSummaryPerformanceDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _address = $v.address;
      _lookbackDays = $v.lookbackDays;
      _symbolFilter = $v.symbolFilter;
      _trades = $v.trades;
      _positions = $v.positions;
      _totalValueUsd = $v.totalValueUsd;
      _longCount = $v.longCount;
      _shortCount = $v.shortCount;
      _winRatePct = $v.winRatePct;
      _pnlUsd = $v.pnlUsd;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleTraderSummaryPerformanceDto other) {
    _$v = other as _$WhaleTraderSummaryPerformanceDto;
  }

  @override
  void update(void Function(WhaleTraderSummaryPerformanceDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleTraderSummaryPerformanceDto build() => _build();

  _$WhaleTraderSummaryPerformanceDto _build() {
    final _$result =
        _$v ??
        _$WhaleTraderSummaryPerformanceDto._(
          address: BuiltValueNullFieldError.checkNotNull(
            address,
            r'WhaleTraderSummaryPerformanceDto',
            'address',
          ),
          lookbackDays: BuiltValueNullFieldError.checkNotNull(
            lookbackDays,
            r'WhaleTraderSummaryPerformanceDto',
            'lookbackDays',
          ),
          symbolFilter: symbolFilter,
          trades: BuiltValueNullFieldError.checkNotNull(
            trades,
            r'WhaleTraderSummaryPerformanceDto',
            'trades',
          ),
          positions: BuiltValueNullFieldError.checkNotNull(
            positions,
            r'WhaleTraderSummaryPerformanceDto',
            'positions',
          ),
          totalValueUsd: BuiltValueNullFieldError.checkNotNull(
            totalValueUsd,
            r'WhaleTraderSummaryPerformanceDto',
            'totalValueUsd',
          ),
          longCount: BuiltValueNullFieldError.checkNotNull(
            longCount,
            r'WhaleTraderSummaryPerformanceDto',
            'longCount',
          ),
          shortCount: BuiltValueNullFieldError.checkNotNull(
            shortCount,
            r'WhaleTraderSummaryPerformanceDto',
            'shortCount',
          ),
          winRatePct: BuiltValueNullFieldError.checkNotNull(
            winRatePct,
            r'WhaleTraderSummaryPerformanceDto',
            'winRatePct',
          ),
          pnlUsd: BuiltValueNullFieldError.checkNotNull(
            pnlUsd,
            r'WhaleTraderSummaryPerformanceDto',
            'pnlUsd',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
