// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_summary_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingCreateJobSummaryDto extends BacktestingCreateJobSummaryDto {
  @override
  final num netProfit;
  @override
  final num netProfitPct;
  @override
  final num maxDrawdownPct;
  @override
  final num winRate;
  @override
  final num? profitFactor;
  @override
  final num totalTrades;
  @override
  final num? totalOpenTrades;
  @override
  final num? openPnl;

  factory _$BacktestingCreateJobSummaryDto([
    void Function(BacktestingCreateJobSummaryDtoBuilder)? updates,
  ]) => (BacktestingCreateJobSummaryDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobSummaryDto._({
    required this.netProfit,
    required this.netProfitPct,
    required this.maxDrawdownPct,
    required this.winRate,
    this.profitFactor,
    required this.totalTrades,
    this.totalOpenTrades,
    this.openPnl,
  }) : super._();
  @override
  BacktestingCreateJobSummaryDto rebuild(
    void Function(BacktestingCreateJobSummaryDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobSummaryDtoBuilder toBuilder() =>
      BacktestingCreateJobSummaryDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobSummaryDto &&
        netProfit == other.netProfit &&
        netProfitPct == other.netProfitPct &&
        maxDrawdownPct == other.maxDrawdownPct &&
        winRate == other.winRate &&
        profitFactor == other.profitFactor &&
        totalTrades == other.totalTrades &&
        totalOpenTrades == other.totalOpenTrades &&
        openPnl == other.openPnl;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, netProfit.hashCode);
    _$hash = $jc(_$hash, netProfitPct.hashCode);
    _$hash = $jc(_$hash, maxDrawdownPct.hashCode);
    _$hash = $jc(_$hash, winRate.hashCode);
    _$hash = $jc(_$hash, profitFactor.hashCode);
    _$hash = $jc(_$hash, totalTrades.hashCode);
    _$hash = $jc(_$hash, totalOpenTrades.hashCode);
    _$hash = $jc(_$hash, openPnl.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobSummaryDto')
          ..add('netProfit', netProfit)
          ..add('netProfitPct', netProfitPct)
          ..add('maxDrawdownPct', maxDrawdownPct)
          ..add('winRate', winRate)
          ..add('profitFactor', profitFactor)
          ..add('totalTrades', totalTrades)
          ..add('totalOpenTrades', totalOpenTrades)
          ..add('openPnl', openPnl))
        .toString();
  }
}

class BacktestingCreateJobSummaryDtoBuilder
    implements
        Builder<
          BacktestingCreateJobSummaryDto,
          BacktestingCreateJobSummaryDtoBuilder
        > {
  _$BacktestingCreateJobSummaryDto? _$v;

  num? _netProfit;
  num? get netProfit => _$this._netProfit;
  set netProfit(num? netProfit) => _$this._netProfit = netProfit;

  num? _netProfitPct;
  num? get netProfitPct => _$this._netProfitPct;
  set netProfitPct(num? netProfitPct) => _$this._netProfitPct = netProfitPct;

  num? _maxDrawdownPct;
  num? get maxDrawdownPct => _$this._maxDrawdownPct;
  set maxDrawdownPct(num? maxDrawdownPct) =>
      _$this._maxDrawdownPct = maxDrawdownPct;

  num? _winRate;
  num? get winRate => _$this._winRate;
  set winRate(num? winRate) => _$this._winRate = winRate;

  num? _profitFactor;
  num? get profitFactor => _$this._profitFactor;
  set profitFactor(num? profitFactor) => _$this._profitFactor = profitFactor;

  num? _totalTrades;
  num? get totalTrades => _$this._totalTrades;
  set totalTrades(num? totalTrades) => _$this._totalTrades = totalTrades;

  num? _totalOpenTrades;
  num? get totalOpenTrades => _$this._totalOpenTrades;
  set totalOpenTrades(num? totalOpenTrades) =>
      _$this._totalOpenTrades = totalOpenTrades;

  num? _openPnl;
  num? get openPnl => _$this._openPnl;
  set openPnl(num? openPnl) => _$this._openPnl = openPnl;

  BacktestingCreateJobSummaryDtoBuilder() {
    BacktestingCreateJobSummaryDto._defaults(this);
  }

  BacktestingCreateJobSummaryDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _netProfit = $v.netProfit;
      _netProfitPct = $v.netProfitPct;
      _maxDrawdownPct = $v.maxDrawdownPct;
      _winRate = $v.winRate;
      _profitFactor = $v.profitFactor;
      _totalTrades = $v.totalTrades;
      _totalOpenTrades = $v.totalOpenTrades;
      _openPnl = $v.openPnl;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobSummaryDto other) {
    _$v = other as _$BacktestingCreateJobSummaryDto;
  }

  @override
  void update(void Function(BacktestingCreateJobSummaryDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobSummaryDto build() => _build();

  _$BacktestingCreateJobSummaryDto _build() {
    final _$result =
        _$v ??
        _$BacktestingCreateJobSummaryDto._(
          netProfit: BuiltValueNullFieldError.checkNotNull(
            netProfit,
            r'BacktestingCreateJobSummaryDto',
            'netProfit',
          ),
          netProfitPct: BuiltValueNullFieldError.checkNotNull(
            netProfitPct,
            r'BacktestingCreateJobSummaryDto',
            'netProfitPct',
          ),
          maxDrawdownPct: BuiltValueNullFieldError.checkNotNull(
            maxDrawdownPct,
            r'BacktestingCreateJobSummaryDto',
            'maxDrawdownPct',
          ),
          winRate: BuiltValueNullFieldError.checkNotNull(
            winRate,
            r'BacktestingCreateJobSummaryDto',
            'winRate',
          ),
          profitFactor: profitFactor,
          totalTrades: BuiltValueNullFieldError.checkNotNull(
            totalTrades,
            r'BacktestingCreateJobSummaryDto',
            'totalTrades',
          ),
          totalOpenTrades: totalOpenTrades,
          openPnl: openPnl,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
