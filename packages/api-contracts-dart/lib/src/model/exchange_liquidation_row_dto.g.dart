// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'exchange_liquidation_row_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const ExchangeLiquidationRowDtoTimeframeEnum
_$exchangeLiquidationRowDtoTimeframeEnum_n1h =
    const ExchangeLiquidationRowDtoTimeframeEnum._('n1h');
const ExchangeLiquidationRowDtoTimeframeEnum
_$exchangeLiquidationRowDtoTimeframeEnum_n4h =
    const ExchangeLiquidationRowDtoTimeframeEnum._('n4h');
const ExchangeLiquidationRowDtoTimeframeEnum
_$exchangeLiquidationRowDtoTimeframeEnum_n12h =
    const ExchangeLiquidationRowDtoTimeframeEnum._('n12h');
const ExchangeLiquidationRowDtoTimeframeEnum
_$exchangeLiquidationRowDtoTimeframeEnum_n24h =
    const ExchangeLiquidationRowDtoTimeframeEnum._('n24h');

ExchangeLiquidationRowDtoTimeframeEnum
_$exchangeLiquidationRowDtoTimeframeEnumValueOf(String name) {
  switch (name) {
    case 'n1h':
      return _$exchangeLiquidationRowDtoTimeframeEnum_n1h;
    case 'n4h':
      return _$exchangeLiquidationRowDtoTimeframeEnum_n4h;
    case 'n12h':
      return _$exchangeLiquidationRowDtoTimeframeEnum_n12h;
    case 'n24h':
      return _$exchangeLiquidationRowDtoTimeframeEnum_n24h;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<ExchangeLiquidationRowDtoTimeframeEnum>
_$exchangeLiquidationRowDtoTimeframeEnumValues =
    BuiltSet<ExchangeLiquidationRowDtoTimeframeEnum>(
      const <ExchangeLiquidationRowDtoTimeframeEnum>[
        _$exchangeLiquidationRowDtoTimeframeEnum_n1h,
        _$exchangeLiquidationRowDtoTimeframeEnum_n4h,
        _$exchangeLiquidationRowDtoTimeframeEnum_n12h,
        _$exchangeLiquidationRowDtoTimeframeEnum_n24h,
      ],
    );

Serializer<ExchangeLiquidationRowDtoTimeframeEnum>
_$exchangeLiquidationRowDtoTimeframeEnumSerializer =
    _$ExchangeLiquidationRowDtoTimeframeEnumSerializer();

class _$ExchangeLiquidationRowDtoTimeframeEnumSerializer
    implements PrimitiveSerializer<ExchangeLiquidationRowDtoTimeframeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'n1h': '1h',
    'n4h': '4h',
    'n12h': '12h',
    'n24h': '24h',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    '1h': 'n1h',
    '4h': 'n4h',
    '12h': 'n12h',
    '24h': 'n24h',
  };

  @override
  final Iterable<Type> types = const <Type>[
    ExchangeLiquidationRowDtoTimeframeEnum,
  ];
  @override
  final String wireName = 'ExchangeLiquidationRowDtoTimeframeEnum';

  @override
  Object serialize(
    Serializers serializers,
    ExchangeLiquidationRowDtoTimeframeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  ExchangeLiquidationRowDtoTimeframeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => ExchangeLiquidationRowDtoTimeframeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$ExchangeLiquidationRowDto extends ExchangeLiquidationRowDto {
  @override
  final String exchange;
  @override
  final String symbol;
  @override
  final ExchangeLiquidationRowDtoTimeframeEnum timeframe;
  @override
  final num amountUsd;
  @override
  final num longUsd;
  @override
  final num shortUsd;
  @override
  final num? longShare;
  @override
  final bool? isTotal;

  factory _$ExchangeLiquidationRowDto([
    void Function(ExchangeLiquidationRowDtoBuilder)? updates,
  ]) => (ExchangeLiquidationRowDtoBuilder()..update(updates))._build();

  _$ExchangeLiquidationRowDto._({
    required this.exchange,
    required this.symbol,
    required this.timeframe,
    required this.amountUsd,
    required this.longUsd,
    required this.shortUsd,
    this.longShare,
    this.isTotal,
  }) : super._();
  @override
  ExchangeLiquidationRowDto rebuild(
    void Function(ExchangeLiquidationRowDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  ExchangeLiquidationRowDtoBuilder toBuilder() =>
      ExchangeLiquidationRowDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is ExchangeLiquidationRowDto &&
        exchange == other.exchange &&
        symbol == other.symbol &&
        timeframe == other.timeframe &&
        amountUsd == other.amountUsd &&
        longUsd == other.longUsd &&
        shortUsd == other.shortUsd &&
        longShare == other.longShare &&
        isTotal == other.isTotal;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, timeframe.hashCode);
    _$hash = $jc(_$hash, amountUsd.hashCode);
    _$hash = $jc(_$hash, longUsd.hashCode);
    _$hash = $jc(_$hash, shortUsd.hashCode);
    _$hash = $jc(_$hash, longShare.hashCode);
    _$hash = $jc(_$hash, isTotal.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'ExchangeLiquidationRowDto')
          ..add('exchange', exchange)
          ..add('symbol', symbol)
          ..add('timeframe', timeframe)
          ..add('amountUsd', amountUsd)
          ..add('longUsd', longUsd)
          ..add('shortUsd', shortUsd)
          ..add('longShare', longShare)
          ..add('isTotal', isTotal))
        .toString();
  }
}

class ExchangeLiquidationRowDtoBuilder
    implements
        Builder<ExchangeLiquidationRowDto, ExchangeLiquidationRowDtoBuilder> {
  _$ExchangeLiquidationRowDto? _$v;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  ExchangeLiquidationRowDtoTimeframeEnum? _timeframe;
  ExchangeLiquidationRowDtoTimeframeEnum? get timeframe => _$this._timeframe;
  set timeframe(ExchangeLiquidationRowDtoTimeframeEnum? timeframe) =>
      _$this._timeframe = timeframe;

  num? _amountUsd;
  num? get amountUsd => _$this._amountUsd;
  set amountUsd(num? amountUsd) => _$this._amountUsd = amountUsd;

  num? _longUsd;
  num? get longUsd => _$this._longUsd;
  set longUsd(num? longUsd) => _$this._longUsd = longUsd;

  num? _shortUsd;
  num? get shortUsd => _$this._shortUsd;
  set shortUsd(num? shortUsd) => _$this._shortUsd = shortUsd;

  num? _longShare;
  num? get longShare => _$this._longShare;
  set longShare(num? longShare) => _$this._longShare = longShare;

  bool? _isTotal;
  bool? get isTotal => _$this._isTotal;
  set isTotal(bool? isTotal) => _$this._isTotal = isTotal;

  ExchangeLiquidationRowDtoBuilder() {
    ExchangeLiquidationRowDto._defaults(this);
  }

  ExchangeLiquidationRowDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _exchange = $v.exchange;
      _symbol = $v.symbol;
      _timeframe = $v.timeframe;
      _amountUsd = $v.amountUsd;
      _longUsd = $v.longUsd;
      _shortUsd = $v.shortUsd;
      _longShare = $v.longShare;
      _isTotal = $v.isTotal;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(ExchangeLiquidationRowDto other) {
    _$v = other as _$ExchangeLiquidationRowDto;
  }

  @override
  void update(void Function(ExchangeLiquidationRowDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  ExchangeLiquidationRowDto build() => _build();

  _$ExchangeLiquidationRowDto _build() {
    final _$result =
        _$v ??
        _$ExchangeLiquidationRowDto._(
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'ExchangeLiquidationRowDto',
            'exchange',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'ExchangeLiquidationRowDto',
            'symbol',
          ),
          timeframe: BuiltValueNullFieldError.checkNotNull(
            timeframe,
            r'ExchangeLiquidationRowDto',
            'timeframe',
          ),
          amountUsd: BuiltValueNullFieldError.checkNotNull(
            amountUsd,
            r'ExchangeLiquidationRowDto',
            'amountUsd',
          ),
          longUsd: BuiltValueNullFieldError.checkNotNull(
            longUsd,
            r'ExchangeLiquidationRowDto',
            'longUsd',
          ),
          shortUsd: BuiltValueNullFieldError.checkNotNull(
            shortUsd,
            r'ExchangeLiquidationRowDto',
            'shortUsd',
          ),
          longShare: longShare,
          isTotal: isTotal,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
