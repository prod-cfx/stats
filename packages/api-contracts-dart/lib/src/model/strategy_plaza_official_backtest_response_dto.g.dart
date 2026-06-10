// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_official_backtest_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaOfficialBacktestResponseDto
    extends StrategyPlazaOfficialBacktestResponseDto {
  @override
  final String generatedAt;
  @override
  final num backtestFrom;
  @override
  final num backtestTo;
  @override
  final String source_;
  @override
  final BuiltMap<String, JsonObject?> dataSource;
  @override
  final BuiltList<JsonObject>? eventDataSources;
  @override
  final num candleCount;
  @override
  final StrategyPlazaOfficialBacktestMetricsResponseDto metrics;
  @override
  final BuiltList<StrategyPlazaOfficialBacktestEquityPointResponseDto>
  equityCurve;
  @override
  final BuiltList<StrategyPlazaOfficialBacktestTradeResponseDto> trades;
  @override
  final StrategyPlazaOfficialBacktestConfidenceResponseDto confidence;
  @override
  final String disclaimer;

  factory _$StrategyPlazaOfficialBacktestResponseDto([
    void Function(StrategyPlazaOfficialBacktestResponseDtoBuilder)? updates,
  ]) => (StrategyPlazaOfficialBacktestResponseDtoBuilder()..update(updates))
      ._build();

  _$StrategyPlazaOfficialBacktestResponseDto._({
    required this.generatedAt,
    required this.backtestFrom,
    required this.backtestTo,
    required this.source_,
    required this.dataSource,
    this.eventDataSources,
    required this.candleCount,
    required this.metrics,
    required this.equityCurve,
    required this.trades,
    required this.confidence,
    required this.disclaimer,
  }) : super._();
  @override
  StrategyPlazaOfficialBacktestResponseDto rebuild(
    void Function(StrategyPlazaOfficialBacktestResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaOfficialBacktestResponseDtoBuilder toBuilder() =>
      StrategyPlazaOfficialBacktestResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaOfficialBacktestResponseDto &&
        generatedAt == other.generatedAt &&
        backtestFrom == other.backtestFrom &&
        backtestTo == other.backtestTo &&
        source_ == other.source_ &&
        dataSource == other.dataSource &&
        eventDataSources == other.eventDataSources &&
        candleCount == other.candleCount &&
        metrics == other.metrics &&
        equityCurve == other.equityCurve &&
        trades == other.trades &&
        confidence == other.confidence &&
        disclaimer == other.disclaimer;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, generatedAt.hashCode);
    _$hash = $jc(_$hash, backtestFrom.hashCode);
    _$hash = $jc(_$hash, backtestTo.hashCode);
    _$hash = $jc(_$hash, source_.hashCode);
    _$hash = $jc(_$hash, dataSource.hashCode);
    _$hash = $jc(_$hash, eventDataSources.hashCode);
    _$hash = $jc(_$hash, candleCount.hashCode);
    _$hash = $jc(_$hash, metrics.hashCode);
    _$hash = $jc(_$hash, equityCurve.hashCode);
    _$hash = $jc(_$hash, trades.hashCode);
    _$hash = $jc(_$hash, confidence.hashCode);
    _$hash = $jc(_$hash, disclaimer.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'StrategyPlazaOfficialBacktestResponseDto',
          )
          ..add('generatedAt', generatedAt)
          ..add('backtestFrom', backtestFrom)
          ..add('backtestTo', backtestTo)
          ..add('source_', source_)
          ..add('dataSource', dataSource)
          ..add('eventDataSources', eventDataSources)
          ..add('candleCount', candleCount)
          ..add('metrics', metrics)
          ..add('equityCurve', equityCurve)
          ..add('trades', trades)
          ..add('confidence', confidence)
          ..add('disclaimer', disclaimer))
        .toString();
  }
}

class StrategyPlazaOfficialBacktestResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaOfficialBacktestResponseDto,
          StrategyPlazaOfficialBacktestResponseDtoBuilder
        > {
  _$StrategyPlazaOfficialBacktestResponseDto? _$v;

  String? _generatedAt;
  String? get generatedAt => _$this._generatedAt;
  set generatedAt(String? generatedAt) => _$this._generatedAt = generatedAt;

  num? _backtestFrom;
  num? get backtestFrom => _$this._backtestFrom;
  set backtestFrom(num? backtestFrom) => _$this._backtestFrom = backtestFrom;

  num? _backtestTo;
  num? get backtestTo => _$this._backtestTo;
  set backtestTo(num? backtestTo) => _$this._backtestTo = backtestTo;

  String? _source_;
  String? get source_ => _$this._source_;
  set source_(String? source_) => _$this._source_ = source_;

  MapBuilder<String, JsonObject?>? _dataSource;
  MapBuilder<String, JsonObject?> get dataSource =>
      _$this._dataSource ??= MapBuilder<String, JsonObject?>();
  set dataSource(MapBuilder<String, JsonObject?>? dataSource) =>
      _$this._dataSource = dataSource;

  ListBuilder<JsonObject>? _eventDataSources;
  ListBuilder<JsonObject> get eventDataSources =>
      _$this._eventDataSources ??= ListBuilder<JsonObject>();
  set eventDataSources(ListBuilder<JsonObject>? eventDataSources) =>
      _$this._eventDataSources = eventDataSources;

  num? _candleCount;
  num? get candleCount => _$this._candleCount;
  set candleCount(num? candleCount) => _$this._candleCount = candleCount;

  StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder? _metrics;
  StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder get metrics =>
      _$this._metrics ??=
          StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder();
  set metrics(
    StrategyPlazaOfficialBacktestMetricsResponseDtoBuilder? metrics,
  ) => _$this._metrics = metrics;

  ListBuilder<StrategyPlazaOfficialBacktestEquityPointResponseDto>?
  _equityCurve;
  ListBuilder<StrategyPlazaOfficialBacktestEquityPointResponseDto>
  get equityCurve => _$this._equityCurve ??=
      ListBuilder<StrategyPlazaOfficialBacktestEquityPointResponseDto>();
  set equityCurve(
    ListBuilder<StrategyPlazaOfficialBacktestEquityPointResponseDto>?
    equityCurve,
  ) => _$this._equityCurve = equityCurve;

  ListBuilder<StrategyPlazaOfficialBacktestTradeResponseDto>? _trades;
  ListBuilder<StrategyPlazaOfficialBacktestTradeResponseDto> get trades =>
      _$this._trades ??=
          ListBuilder<StrategyPlazaOfficialBacktestTradeResponseDto>();
  set trades(
    ListBuilder<StrategyPlazaOfficialBacktestTradeResponseDto>? trades,
  ) => _$this._trades = trades;

  StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder? _confidence;
  StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder get confidence =>
      _$this._confidence ??=
          StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder();
  set confidence(
    StrategyPlazaOfficialBacktestConfidenceResponseDtoBuilder? confidence,
  ) => _$this._confidence = confidence;

  String? _disclaimer;
  String? get disclaimer => _$this._disclaimer;
  set disclaimer(String? disclaimer) => _$this._disclaimer = disclaimer;

  StrategyPlazaOfficialBacktestResponseDtoBuilder() {
    StrategyPlazaOfficialBacktestResponseDto._defaults(this);
  }

  StrategyPlazaOfficialBacktestResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _generatedAt = $v.generatedAt;
      _backtestFrom = $v.backtestFrom;
      _backtestTo = $v.backtestTo;
      _source_ = $v.source_;
      _dataSource = $v.dataSource.toBuilder();
      _eventDataSources = $v.eventDataSources?.toBuilder();
      _candleCount = $v.candleCount;
      _metrics = $v.metrics.toBuilder();
      _equityCurve = $v.equityCurve.toBuilder();
      _trades = $v.trades.toBuilder();
      _confidence = $v.confidence.toBuilder();
      _disclaimer = $v.disclaimer;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaOfficialBacktestResponseDto other) {
    _$v = other as _$StrategyPlazaOfficialBacktestResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaOfficialBacktestResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaOfficialBacktestResponseDto build() => _build();

  _$StrategyPlazaOfficialBacktestResponseDto _build() {
    _$StrategyPlazaOfficialBacktestResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaOfficialBacktestResponseDto._(
            generatedAt: BuiltValueNullFieldError.checkNotNull(
              generatedAt,
              r'StrategyPlazaOfficialBacktestResponseDto',
              'generatedAt',
            ),
            backtestFrom: BuiltValueNullFieldError.checkNotNull(
              backtestFrom,
              r'StrategyPlazaOfficialBacktestResponseDto',
              'backtestFrom',
            ),
            backtestTo: BuiltValueNullFieldError.checkNotNull(
              backtestTo,
              r'StrategyPlazaOfficialBacktestResponseDto',
              'backtestTo',
            ),
            source_: BuiltValueNullFieldError.checkNotNull(
              source_,
              r'StrategyPlazaOfficialBacktestResponseDto',
              'source_',
            ),
            dataSource: dataSource.build(),
            eventDataSources: _eventDataSources?.build(),
            candleCount: BuiltValueNullFieldError.checkNotNull(
              candleCount,
              r'StrategyPlazaOfficialBacktestResponseDto',
              'candleCount',
            ),
            metrics: metrics.build(),
            equityCurve: equityCurve.build(),
            trades: trades.build(),
            confidence: confidence.build(),
            disclaimer: BuiltValueNullFieldError.checkNotNull(
              disclaimer,
              r'StrategyPlazaOfficialBacktestResponseDto',
              'disclaimer',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'dataSource';
        dataSource.build();
        _$failedField = 'eventDataSources';
        _eventDataSources?.build();

        _$failedField = 'metrics';
        metrics.build();
        _$failedField = 'equityCurve';
        equityCurve.build();
        _$failedField = 'trades';
        trades.build();
        _$failedField = 'confidence';
        confidence.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'StrategyPlazaOfficialBacktestResponseDto',
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
