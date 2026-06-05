// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_create_job_bar_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n1m =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n1m');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n3m =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n3m');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n5m =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n5m');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n15m =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n15m');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n30m =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n30m');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n1h =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n1h');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n4h =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n4h');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n6h =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n6h');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n8h =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n8h');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n12h =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n12h');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n1d =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n1d');
const BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnum_n1w =
    const BacktestingCreateJobBarDtoTimeframeEnum._('n1w');

BacktestingCreateJobBarDtoTimeframeEnum
_$backtestingCreateJobBarDtoTimeframeEnumValueOf(String name) {
  switch (name) {
    case 'n1m':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n1m;
    case 'n3m':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n3m;
    case 'n5m':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n5m;
    case 'n15m':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n15m;
    case 'n30m':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n30m;
    case 'n1h':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n1h;
    case 'n4h':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n4h;
    case 'n6h':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n6h;
    case 'n8h':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n8h;
    case 'n12h':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n12h;
    case 'n1d':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n1d;
    case 'n1w':
      return _$backtestingCreateJobBarDtoTimeframeEnum_n1w;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<BacktestingCreateJobBarDtoTimeframeEnum>
_$backtestingCreateJobBarDtoTimeframeEnumValues =
    BuiltSet<BacktestingCreateJobBarDtoTimeframeEnum>(
      const <BacktestingCreateJobBarDtoTimeframeEnum>[
        _$backtestingCreateJobBarDtoTimeframeEnum_n1m,
        _$backtestingCreateJobBarDtoTimeframeEnum_n3m,
        _$backtestingCreateJobBarDtoTimeframeEnum_n5m,
        _$backtestingCreateJobBarDtoTimeframeEnum_n15m,
        _$backtestingCreateJobBarDtoTimeframeEnum_n30m,
        _$backtestingCreateJobBarDtoTimeframeEnum_n1h,
        _$backtestingCreateJobBarDtoTimeframeEnum_n4h,
        _$backtestingCreateJobBarDtoTimeframeEnum_n6h,
        _$backtestingCreateJobBarDtoTimeframeEnum_n8h,
        _$backtestingCreateJobBarDtoTimeframeEnum_n12h,
        _$backtestingCreateJobBarDtoTimeframeEnum_n1d,
        _$backtestingCreateJobBarDtoTimeframeEnum_n1w,
      ],
    );

Serializer<BacktestingCreateJobBarDtoTimeframeEnum>
_$backtestingCreateJobBarDtoTimeframeEnumSerializer =
    _$BacktestingCreateJobBarDtoTimeframeEnumSerializer();

class _$BacktestingCreateJobBarDtoTimeframeEnumSerializer
    implements PrimitiveSerializer<BacktestingCreateJobBarDtoTimeframeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'n1m': '1m',
    'n3m': '3m',
    'n5m': '5m',
    'n15m': '15m',
    'n30m': '30m',
    'n1h': '1h',
    'n4h': '4h',
    'n6h': '6h',
    'n8h': '8h',
    'n12h': '12h',
    'n1d': '1d',
    'n1w': '1w',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    '1m': 'n1m',
    '3m': 'n3m',
    '5m': 'n5m',
    '15m': 'n15m',
    '30m': 'n30m',
    '1h': 'n1h',
    '4h': 'n4h',
    '6h': 'n6h',
    '8h': 'n8h',
    '12h': 'n12h',
    '1d': 'n1d',
    '1w': 'n1w',
  };

  @override
  final Iterable<Type> types = const <Type>[
    BacktestingCreateJobBarDtoTimeframeEnum,
  ];
  @override
  final String wireName = 'BacktestingCreateJobBarDtoTimeframeEnum';

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobBarDtoTimeframeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  BacktestingCreateJobBarDtoTimeframeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => BacktestingCreateJobBarDtoTimeframeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$BacktestingCreateJobBarDto extends BacktestingCreateJobBarDto {
  @override
  final String symbol;
  @override
  final BacktestingCreateJobBarDtoTimeframeEnum timeframe;
  @override
  final num openTime;
  @override
  final num closeTime;
  @override
  final num open;
  @override
  final num high;
  @override
  final num low;
  @override
  final num close;
  @override
  final num volume;

  factory _$BacktestingCreateJobBarDto([
    void Function(BacktestingCreateJobBarDtoBuilder)? updates,
  ]) => (BacktestingCreateJobBarDtoBuilder()..update(updates))._build();

  _$BacktestingCreateJobBarDto._({
    required this.symbol,
    required this.timeframe,
    required this.openTime,
    required this.closeTime,
    required this.open,
    required this.high,
    required this.low,
    required this.close,
    required this.volume,
  }) : super._();
  @override
  BacktestingCreateJobBarDto rebuild(
    void Function(BacktestingCreateJobBarDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingCreateJobBarDtoBuilder toBuilder() =>
      BacktestingCreateJobBarDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingCreateJobBarDto &&
        symbol == other.symbol &&
        timeframe == other.timeframe &&
        openTime == other.openTime &&
        closeTime == other.closeTime &&
        open == other.open &&
        high == other.high &&
        low == other.low &&
        close == other.close &&
        volume == other.volume;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, timeframe.hashCode);
    _$hash = $jc(_$hash, openTime.hashCode);
    _$hash = $jc(_$hash, closeTime.hashCode);
    _$hash = $jc(_$hash, open.hashCode);
    _$hash = $jc(_$hash, high.hashCode);
    _$hash = $jc(_$hash, low.hashCode);
    _$hash = $jc(_$hash, close.hashCode);
    _$hash = $jc(_$hash, volume.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BacktestingCreateJobBarDto')
          ..add('symbol', symbol)
          ..add('timeframe', timeframe)
          ..add('openTime', openTime)
          ..add('closeTime', closeTime)
          ..add('open', open)
          ..add('high', high)
          ..add('low', low)
          ..add('close', close)
          ..add('volume', volume))
        .toString();
  }
}

class BacktestingCreateJobBarDtoBuilder
    implements
        Builder<BacktestingCreateJobBarDto, BacktestingCreateJobBarDtoBuilder> {
  _$BacktestingCreateJobBarDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  BacktestingCreateJobBarDtoTimeframeEnum? _timeframe;
  BacktestingCreateJobBarDtoTimeframeEnum? get timeframe => _$this._timeframe;
  set timeframe(BacktestingCreateJobBarDtoTimeframeEnum? timeframe) =>
      _$this._timeframe = timeframe;

  num? _openTime;
  num? get openTime => _$this._openTime;
  set openTime(num? openTime) => _$this._openTime = openTime;

  num? _closeTime;
  num? get closeTime => _$this._closeTime;
  set closeTime(num? closeTime) => _$this._closeTime = closeTime;

  num? _open;
  num? get open => _$this._open;
  set open(num? open) => _$this._open = open;

  num? _high;
  num? get high => _$this._high;
  set high(num? high) => _$this._high = high;

  num? _low;
  num? get low => _$this._low;
  set low(num? low) => _$this._low = low;

  num? _close;
  num? get close => _$this._close;
  set close(num? close) => _$this._close = close;

  num? _volume;
  num? get volume => _$this._volume;
  set volume(num? volume) => _$this._volume = volume;

  BacktestingCreateJobBarDtoBuilder() {
    BacktestingCreateJobBarDto._defaults(this);
  }

  BacktestingCreateJobBarDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _timeframe = $v.timeframe;
      _openTime = $v.openTime;
      _closeTime = $v.closeTime;
      _open = $v.open;
      _high = $v.high;
      _low = $v.low;
      _close = $v.close;
      _volume = $v.volume;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingCreateJobBarDto other) {
    _$v = other as _$BacktestingCreateJobBarDto;
  }

  @override
  void update(void Function(BacktestingCreateJobBarDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingCreateJobBarDto build() => _build();

  _$BacktestingCreateJobBarDto _build() {
    final _$result =
        _$v ??
        _$BacktestingCreateJobBarDto._(
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'BacktestingCreateJobBarDto',
            'symbol',
          ),
          timeframe: BuiltValueNullFieldError.checkNotNull(
            timeframe,
            r'BacktestingCreateJobBarDto',
            'timeframe',
          ),
          openTime: BuiltValueNullFieldError.checkNotNull(
            openTime,
            r'BacktestingCreateJobBarDto',
            'openTime',
          ),
          closeTime: BuiltValueNullFieldError.checkNotNull(
            closeTime,
            r'BacktestingCreateJobBarDto',
            'closeTime',
          ),
          open: BuiltValueNullFieldError.checkNotNull(
            open,
            r'BacktestingCreateJobBarDto',
            'open',
          ),
          high: BuiltValueNullFieldError.checkNotNull(
            high,
            r'BacktestingCreateJobBarDto',
            'high',
          ),
          low: BuiltValueNullFieldError.checkNotNull(
            low,
            r'BacktestingCreateJobBarDto',
            'low',
          ),
          close: BuiltValueNullFieldError.checkNotNull(
            close,
            r'BacktestingCreateJobBarDto',
            'close',
          ),
          volume: BuiltValueNullFieldError.checkNotNull(
            volume,
            r'BacktestingCreateJobBarDto',
            'volume',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
