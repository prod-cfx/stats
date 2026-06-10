// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_official_backtest_equity_point_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaOfficialBacktestEquityPointResponseDto
    extends StrategyPlazaOfficialBacktestEquityPointResponseDto {
  @override
  final num ts;
  @override
  final num equity;

  factory _$StrategyPlazaOfficialBacktestEquityPointResponseDto([
    void Function(StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder)?
    updates,
  ]) =>
      (StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder()
            ..update(updates))
          ._build();

  _$StrategyPlazaOfficialBacktestEquityPointResponseDto._({
    required this.ts,
    required this.equity,
  }) : super._();
  @override
  StrategyPlazaOfficialBacktestEquityPointResponseDto rebuild(
    void Function(StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder toBuilder() =>
      StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaOfficialBacktestEquityPointResponseDto &&
        ts == other.ts &&
        equity == other.equity;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, ts.hashCode);
    _$hash = $jc(_$hash, equity.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'StrategyPlazaOfficialBacktestEquityPointResponseDto',
          )
          ..add('ts', ts)
          ..add('equity', equity))
        .toString();
  }
}

class StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaOfficialBacktestEquityPointResponseDto,
          StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder
        > {
  _$StrategyPlazaOfficialBacktestEquityPointResponseDto? _$v;

  num? _ts;
  num? get ts => _$this._ts;
  set ts(num? ts) => _$this._ts = ts;

  num? _equity;
  num? get equity => _$this._equity;
  set equity(num? equity) => _$this._equity = equity;

  StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder() {
    StrategyPlazaOfficialBacktestEquityPointResponseDto._defaults(this);
  }

  StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _ts = $v.ts;
      _equity = $v.equity;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaOfficialBacktestEquityPointResponseDto other) {
    _$v = other as _$StrategyPlazaOfficialBacktestEquityPointResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaOfficialBacktestEquityPointResponseDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaOfficialBacktestEquityPointResponseDto build() => _build();

  _$StrategyPlazaOfficialBacktestEquityPointResponseDto _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaOfficialBacktestEquityPointResponseDto._(
          ts: BuiltValueNullFieldError.checkNotNull(
            ts,
            r'StrategyPlazaOfficialBacktestEquityPointResponseDto',
            'ts',
          ),
          equity: BuiltValueNullFieldError.checkNotNull(
            equity,
            r'StrategyPlazaOfficialBacktestEquityPointResponseDto',
            'equity',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
