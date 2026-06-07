// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_report_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingReportResponseDto extends BacktestingReportResponseDto {
  @override
  final BuiltMap<String, JsonObject?> summary;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>> equityCurve;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>> trades;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>> markers;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>> bySymbol;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>>? openPositions;
  @override
  final BuiltList<BuiltMap<String, JsonObject?>>? pendingSignals;

  factory _$BacktestingReportResponseDto([
    void Function(BacktestingReportResponseDtoBuilder)? updates,
  ]) => (BacktestingReportResponseDtoBuilder()..update(updates))._build();

  _$BacktestingReportResponseDto._({
    required this.summary,
    required this.equityCurve,
    required this.trades,
    required this.markers,
    required this.bySymbol,
    this.openPositions,
    this.pendingSignals,
  }) : super._();
  @override
  BacktestingReportResponseDto rebuild(
    void Function(BacktestingReportResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingReportResponseDtoBuilder toBuilder() =>
      BacktestingReportResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingReportResponseDto &&
        summary == other.summary &&
        equityCurve == other.equityCurve &&
        trades == other.trades &&
        markers == other.markers &&
        bySymbol == other.bySymbol &&
        openPositions == other.openPositions &&
        pendingSignals == other.pendingSignals;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, summary.hashCode);
    _$hash = $jc(_$hash, equityCurve.hashCode);
    _$hash = $jc(_$hash, trades.hashCode);
    _$hash = $jc(_$hash, markers.hashCode);
    _$hash = $jc(_$hash, bySymbol.hashCode);
    _$hash = $jc(_$hash, openPositions.hashCode);
    _$hash = $jc(_$hash, pendingSignals.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingReportResponseDto')
          ..add('summary', summary)
          ..add('equityCurve', equityCurve)
          ..add('trades', trades)
          ..add('markers', markers)
          ..add('bySymbol', bySymbol)
          ..add('openPositions', openPositions)
          ..add('pendingSignals', pendingSignals))
        .toString();
  }
}

class BacktestingReportResponseDtoBuilder
    implements
        Builder<
          BacktestingReportResponseDto,
          BacktestingReportResponseDtoBuilder
        > {
  _$BacktestingReportResponseDto? _$v;

  MapBuilder<String, JsonObject?>? _summary;
  MapBuilder<String, JsonObject?> get summary =>
      _$this._summary ??= MapBuilder<String, JsonObject?>();
  set summary(MapBuilder<String, JsonObject?>? summary) =>
      _$this._summary = summary;

  ListBuilder<BuiltMap<String, JsonObject?>>? _equityCurve;
  ListBuilder<BuiltMap<String, JsonObject?>> get equityCurve =>
      _$this._equityCurve ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set equityCurve(ListBuilder<BuiltMap<String, JsonObject?>>? equityCurve) =>
      _$this._equityCurve = equityCurve;

  ListBuilder<BuiltMap<String, JsonObject?>>? _trades;
  ListBuilder<BuiltMap<String, JsonObject?>> get trades =>
      _$this._trades ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set trades(ListBuilder<BuiltMap<String, JsonObject?>>? trades) =>
      _$this._trades = trades;

  ListBuilder<BuiltMap<String, JsonObject?>>? _markers;
  ListBuilder<BuiltMap<String, JsonObject?>> get markers =>
      _$this._markers ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set markers(ListBuilder<BuiltMap<String, JsonObject?>>? markers) =>
      _$this._markers = markers;

  ListBuilder<BuiltMap<String, JsonObject?>>? _bySymbol;
  ListBuilder<BuiltMap<String, JsonObject?>> get bySymbol =>
      _$this._bySymbol ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set bySymbol(ListBuilder<BuiltMap<String, JsonObject?>>? bySymbol) =>
      _$this._bySymbol = bySymbol;

  ListBuilder<BuiltMap<String, JsonObject?>>? _openPositions;
  ListBuilder<BuiltMap<String, JsonObject?>> get openPositions =>
      _$this._openPositions ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set openPositions(
    ListBuilder<BuiltMap<String, JsonObject?>>? openPositions,
  ) => _$this._openPositions = openPositions;

  ListBuilder<BuiltMap<String, JsonObject?>>? _pendingSignals;
  ListBuilder<BuiltMap<String, JsonObject?>> get pendingSignals =>
      _$this._pendingSignals ??= ListBuilder<BuiltMap<String, JsonObject?>>();
  set pendingSignals(
    ListBuilder<BuiltMap<String, JsonObject?>>? pendingSignals,
  ) => _$this._pendingSignals = pendingSignals;

  BacktestingReportResponseDtoBuilder() {
    BacktestingReportResponseDto._defaults(this);
  }

  BacktestingReportResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _summary = $v.summary.toBuilder();
      _equityCurve = $v.equityCurve.toBuilder();
      _trades = $v.trades.toBuilder();
      _markers = $v.markers.toBuilder();
      _bySymbol = $v.bySymbol.toBuilder();
      _openPositions = $v.openPositions?.toBuilder();
      _pendingSignals = $v.pendingSignals?.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingReportResponseDto other) {
    _$v = other as _$BacktestingReportResponseDto;
  }

  @override
  void update(void Function(BacktestingReportResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingReportResponseDto build() => _build();

  _$BacktestingReportResponseDto _build() {
    _$BacktestingReportResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingReportResponseDto._(
            summary: summary.build(),
            equityCurve: equityCurve.build(),
            trades: trades.build(),
            markers: markers.build(),
            bySymbol: bySymbol.build(),
            openPositions: _openPositions?.build(),
            pendingSignals: _pendingSignals?.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'summary';
        summary.build();
        _$failedField = 'equityCurve';
        equityCurve.build();
        _$failedField = 'trades';
        trades.build();
        _$failedField = 'markers';
        markers.build();
        _$failedField = 'bySymbol';
        bySymbol.build();
        _$failedField = 'openPositions';
        _openPositions?.build();
        _$failedField = 'pendingSignals';
        _pendingSignals?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'BacktestingReportResponseDto',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
