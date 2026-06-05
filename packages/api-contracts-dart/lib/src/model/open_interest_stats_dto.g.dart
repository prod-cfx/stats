// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_interest_stats_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OpenInterestStatsDto extends OpenInterestStatsDto {
  @override
  final String symbol;
  @override
  final DateTime startTime;
  @override
  final DateTime endTime;
  @override
  final num dataPoints;
  @override
  final num max;
  @override
  final num min;
  @override
  final num avg;
  @override
  final num latest;
  @override
  final num earliest;
  @override
  final num change;
  @override
  final num changePercent;

  factory _$OpenInterestStatsDto([
    void Function(OpenInterestStatsDtoBuilder)? updates,
  ]) => (OpenInterestStatsDtoBuilder()..update(updates))._build();

  _$OpenInterestStatsDto._({
    required this.symbol,
    required this.startTime,
    required this.endTime,
    required this.dataPoints,
    required this.max,
    required this.min,
    required this.avg,
    required this.latest,
    required this.earliest,
    required this.change,
    required this.changePercent,
  }) : super._();
  @override
  OpenInterestStatsDto rebuild(
    void Function(OpenInterestStatsDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OpenInterestStatsDtoBuilder toBuilder() =>
      OpenInterestStatsDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OpenInterestStatsDto &&
        symbol == other.symbol &&
        startTime == other.startTime &&
        endTime == other.endTime &&
        dataPoints == other.dataPoints &&
        max == other.max &&
        min == other.min &&
        avg == other.avg &&
        latest == other.latest &&
        earliest == other.earliest &&
        change == other.change &&
        changePercent == other.changePercent;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, startTime.hashCode);
    _$hash = $jc(_$hash, endTime.hashCode);
    _$hash = $jc(_$hash, dataPoints.hashCode);
    _$hash = $jc(_$hash, max.hashCode);
    _$hash = $jc(_$hash, min.hashCode);
    _$hash = $jc(_$hash, avg.hashCode);
    _$hash = $jc(_$hash, latest.hashCode);
    _$hash = $jc(_$hash, earliest.hashCode);
    _$hash = $jc(_$hash, change.hashCode);
    _$hash = $jc(_$hash, changePercent.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OpenInterestStatsDto')
          ..add('symbol', symbol)
          ..add('startTime', startTime)
          ..add('endTime', endTime)
          ..add('dataPoints', dataPoints)
          ..add('max', max)
          ..add('min', min)
          ..add('avg', avg)
          ..add('latest', latest)
          ..add('earliest', earliest)
          ..add('change', change)
          ..add('changePercent', changePercent))
        .toString();
  }
}

class OpenInterestStatsDtoBuilder
    implements Builder<OpenInterestStatsDto, OpenInterestStatsDtoBuilder> {
  _$OpenInterestStatsDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  DateTime? _startTime;
  DateTime? get startTime => _$this._startTime;
  set startTime(DateTime? startTime) => _$this._startTime = startTime;

  DateTime? _endTime;
  DateTime? get endTime => _$this._endTime;
  set endTime(DateTime? endTime) => _$this._endTime = endTime;

  num? _dataPoints;
  num? get dataPoints => _$this._dataPoints;
  set dataPoints(num? dataPoints) => _$this._dataPoints = dataPoints;

  num? _max;
  num? get max => _$this._max;
  set max(num? max) => _$this._max = max;

  num? _min;
  num? get min => _$this._min;
  set min(num? min) => _$this._min = min;

  num? _avg;
  num? get avg => _$this._avg;
  set avg(num? avg) => _$this._avg = avg;

  num? _latest;
  num? get latest => _$this._latest;
  set latest(num? latest) => _$this._latest = latest;

  num? _earliest;
  num? get earliest => _$this._earliest;
  set earliest(num? earliest) => _$this._earliest = earliest;

  num? _change;
  num? get change => _$this._change;
  set change(num? change) => _$this._change = change;

  num? _changePercent;
  num? get changePercent => _$this._changePercent;
  set changePercent(num? changePercent) =>
      _$this._changePercent = changePercent;

  OpenInterestStatsDtoBuilder() {
    OpenInterestStatsDto._defaults(this);
  }

  OpenInterestStatsDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _startTime = $v.startTime;
      _endTime = $v.endTime;
      _dataPoints = $v.dataPoints;
      _max = $v.max;
      _min = $v.min;
      _avg = $v.avg;
      _latest = $v.latest;
      _earliest = $v.earliest;
      _change = $v.change;
      _changePercent = $v.changePercent;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OpenInterestStatsDto other) {
    _$v = other as _$OpenInterestStatsDto;
  }

  @override
  void update(void Function(OpenInterestStatsDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OpenInterestStatsDto build() => _build();

  _$OpenInterestStatsDto _build() {
    final _$result =
        _$v ??
        _$OpenInterestStatsDto._(
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'OpenInterestStatsDto',
            'symbol',
          ),
          startTime: BuiltValueNullFieldError.checkNotNull(
            startTime,
            r'OpenInterestStatsDto',
            'startTime',
          ),
          endTime: BuiltValueNullFieldError.checkNotNull(
            endTime,
            r'OpenInterestStatsDto',
            'endTime',
          ),
          dataPoints: BuiltValueNullFieldError.checkNotNull(
            dataPoints,
            r'OpenInterestStatsDto',
            'dataPoints',
          ),
          max: BuiltValueNullFieldError.checkNotNull(
            max,
            r'OpenInterestStatsDto',
            'max',
          ),
          min: BuiltValueNullFieldError.checkNotNull(
            min,
            r'OpenInterestStatsDto',
            'min',
          ),
          avg: BuiltValueNullFieldError.checkNotNull(
            avg,
            r'OpenInterestStatsDto',
            'avg',
          ),
          latest: BuiltValueNullFieldError.checkNotNull(
            latest,
            r'OpenInterestStatsDto',
            'latest',
          ),
          earliest: BuiltValueNullFieldError.checkNotNull(
            earliest,
            r'OpenInterestStatsDto',
            'earliest',
          ),
          change: BuiltValueNullFieldError.checkNotNull(
            change,
            r'OpenInterestStatsDto',
            'change',
          ),
          changePercent: BuiltValueNullFieldError.checkNotNull(
            changePercent,
            r'OpenInterestStatsDto',
            'changePercent',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
