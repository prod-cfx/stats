// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_official_backtest_metrics_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaOfficialBacktestMetricsResponseDto
    extends StrategyPlazaOfficialBacktestMetricsResponseDto {
  @override
  final num? returnPct;
  @override
  final num? winRatePct;
  @override
  final num? maxDrawdownPct;
  @override
  final num? tradeCount;

  factory _$StrategyPlazaOfficialBacktestMetricsResponseDto([
    void Function(StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder)?
    updates,
  ]) =>
      (StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder()
            ..update(updates))
          ._build();

  _$StrategyPlazaOfficialBacktestMetricsResponseDto._({
    this.returnPct,
    this.winRatePct,
    this.maxDrawdownPct,
    this.tradeCount,
  }) : super._();
  @override
  StrategyPlazaOfficialBacktestMetricsResponseDto rebuild(
    void Function(StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder toBuilder() =>
      StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaOfficialBacktestMetricsResponseDto &&
        returnPct == other.returnPct &&
        winRatePct == other.winRatePct &&
        maxDrawdownPct == other.maxDrawdownPct &&
        tradeCount == other.tradeCount;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, returnPct.hashCode);
    _$hash = $jc(_$hash, winRatePct.hashCode);
    _$hash = $jc(_$hash, maxDrawdownPct.hashCode);
    _$hash = $jc(_$hash, tradeCount.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'StrategyPlazaOfficialBacktestMetricsResponseDto',
          )
          ..add('returnPct', returnPct)
          ..add('winRatePct', winRatePct)
          ..add('maxDrawdownPct', maxDrawdownPct)
          ..add('tradeCount', tradeCount))
        .toString();
  }
}

class StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaOfficialBacktestMetricsResponseDto,
          StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder
        > {
  _$StrategyPlazaOfficialBacktestMetricsResponseDto? _$v;

  num? _returnPct;
  num? get returnPct => _$this._returnPct;
  set returnPct(num? returnPct) => _$this._returnPct = returnPct;

  num? _winRatePct;
  num? get winRatePct => _$this._winRatePct;
  set winRatePct(num? winRatePct) => _$this._winRatePct = winRatePct;

  num? _maxDrawdownPct;
  num? get maxDrawdownPct => _$this._maxDrawdownPct;
  set maxDrawdownPct(num? maxDrawdownPct) =>
      _$this._maxDrawdownPct = maxDrawdownPct;

  num? _tradeCount;
  num? get tradeCount => _$this._tradeCount;
  set tradeCount(num? tradeCount) => _$this._tradeCount = tradeCount;

  StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder() {
    StrategyPlazaOfficialBacktestMetricsResponseDto._defaults(this);
  }

  StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _returnPct = $v.returnPct;
      _winRatePct = $v.winRatePct;
      _maxDrawdownPct = $v.maxDrawdownPct;
      _tradeCount = $v.tradeCount;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaOfficialBacktestMetricsResponseDto other) {
    _$v = other as _$StrategyPlazaOfficialBacktestMetricsResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaOfficialBacktestMetricsResponseDto build() => _build();

  _$StrategyPlazaOfficialBacktestMetricsResponseDto _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaOfficialBacktestMetricsResponseDto._(
          returnPct: returnPct,
          winRatePct: winRatePct,
          maxDrawdownPct: maxDrawdownPct,
          tradeCount: tradeCount,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
