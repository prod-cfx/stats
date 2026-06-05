// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'market_trade_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const MarketTradeResponseDtoInstrumentTypeEnum
_$marketTradeResponseDtoInstrumentTypeEnum_SPOT =
    const MarketTradeResponseDtoInstrumentTypeEnum._('SPOT');
const MarketTradeResponseDtoInstrumentTypeEnum
_$marketTradeResponseDtoInstrumentTypeEnum_PERPETUAL =
    const MarketTradeResponseDtoInstrumentTypeEnum._('PERPETUAL');
const MarketTradeResponseDtoInstrumentTypeEnum
_$marketTradeResponseDtoInstrumentTypeEnum_FUTURE =
    const MarketTradeResponseDtoInstrumentTypeEnum._('FUTURE');

MarketTradeResponseDtoInstrumentTypeEnum
_$marketTradeResponseDtoInstrumentTypeEnumValueOf(String name) {
  switch (name) {
    case 'SPOT':
      return _$marketTradeResponseDtoInstrumentTypeEnum_SPOT;
    case 'PERPETUAL':
      return _$marketTradeResponseDtoInstrumentTypeEnum_PERPETUAL;
    case 'FUTURE':
      return _$marketTradeResponseDtoInstrumentTypeEnum_FUTURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<MarketTradeResponseDtoInstrumentTypeEnum>
_$marketTradeResponseDtoInstrumentTypeEnumValues =
    BuiltSet<MarketTradeResponseDtoInstrumentTypeEnum>(
      const <MarketTradeResponseDtoInstrumentTypeEnum>[
        _$marketTradeResponseDtoInstrumentTypeEnum_SPOT,
        _$marketTradeResponseDtoInstrumentTypeEnum_PERPETUAL,
        _$marketTradeResponseDtoInstrumentTypeEnum_FUTURE,
      ],
    );

const MarketTradeResponseDtoSideEnum _$marketTradeResponseDtoSideEnum_buy =
    const MarketTradeResponseDtoSideEnum._('buy');
const MarketTradeResponseDtoSideEnum _$marketTradeResponseDtoSideEnum_sell =
    const MarketTradeResponseDtoSideEnum._('sell');

MarketTradeResponseDtoSideEnum _$marketTradeResponseDtoSideEnumValueOf(
  String name,
) {
  switch (name) {
    case 'buy':
      return _$marketTradeResponseDtoSideEnum_buy;
    case 'sell':
      return _$marketTradeResponseDtoSideEnum_sell;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<MarketTradeResponseDtoSideEnum>
_$marketTradeResponseDtoSideEnumValues =
    BuiltSet<MarketTradeResponseDtoSideEnum>(
      const <MarketTradeResponseDtoSideEnum>[
        _$marketTradeResponseDtoSideEnum_buy,
        _$marketTradeResponseDtoSideEnum_sell,
      ],
    );

Serializer<MarketTradeResponseDtoInstrumentTypeEnum>
_$marketTradeResponseDtoInstrumentTypeEnumSerializer =
    _$MarketTradeResponseDtoInstrumentTypeEnumSerializer();
Serializer<MarketTradeResponseDtoSideEnum>
_$marketTradeResponseDtoSideEnumSerializer =
    _$MarketTradeResponseDtoSideEnumSerializer();

class _$MarketTradeResponseDtoInstrumentTypeEnumSerializer
    implements PrimitiveSerializer<MarketTradeResponseDtoInstrumentTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'SPOT': 'SPOT',
    'PERPETUAL': 'PERPETUAL',
    'FUTURE': 'FUTURE',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'SPOT': 'SPOT',
    'PERPETUAL': 'PERPETUAL',
    'FUTURE': 'FUTURE',
  };

  @override
  final Iterable<Type> types = const <Type>[
    MarketTradeResponseDtoInstrumentTypeEnum,
  ];
  @override
  final String wireName = 'MarketTradeResponseDtoInstrumentTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    MarketTradeResponseDtoInstrumentTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  MarketTradeResponseDtoInstrumentTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => MarketTradeResponseDtoInstrumentTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$MarketTradeResponseDtoSideEnumSerializer
    implements PrimitiveSerializer<MarketTradeResponseDtoSideEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'buy': 'buy',
    'sell': 'sell',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'buy': 'buy',
    'sell': 'sell',
  };

  @override
  final Iterable<Type> types = const <Type>[MarketTradeResponseDtoSideEnum];
  @override
  final String wireName = 'MarketTradeResponseDtoSideEnum';

  @override
  Object serialize(
    Serializers serializers,
    MarketTradeResponseDtoSideEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  MarketTradeResponseDtoSideEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => MarketTradeResponseDtoSideEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$MarketTradeResponseDto extends MarketTradeResponseDto {
  @override
  final num id;
  @override
  final String exchange;
  @override
  final MarketTradeResponseDtoInstrumentTypeEnum instrumentType;
  @override
  final String symbol;
  @override
  final String baseAsset;
  @override
  final String quoteAsset;
  @override
  final String tradeId;
  @override
  final String price;
  @override
  final String size;
  @override
  final MarketTradeResponseDtoSideEnum side;
  @override
  final String tradeTimestamp;
  @override
  final String createdAt;

  factory _$MarketTradeResponseDto([
    void Function(MarketTradeResponseDtoBuilder)? updates,
  ]) => (MarketTradeResponseDtoBuilder()..update(updates))._build();

  _$MarketTradeResponseDto._({
    required this.id,
    required this.exchange,
    required this.instrumentType,
    required this.symbol,
    required this.baseAsset,
    required this.quoteAsset,
    required this.tradeId,
    required this.price,
    required this.size,
    required this.side,
    required this.tradeTimestamp,
    required this.createdAt,
  }) : super._();
  @override
  MarketTradeResponseDto rebuild(
    void Function(MarketTradeResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  MarketTradeResponseDtoBuilder toBuilder() =>
      MarketTradeResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MarketTradeResponseDto &&
        id == other.id &&
        exchange == other.exchange &&
        instrumentType == other.instrumentType &&
        symbol == other.symbol &&
        baseAsset == other.baseAsset &&
        quoteAsset == other.quoteAsset &&
        tradeId == other.tradeId &&
        price == other.price &&
        size == other.size &&
        side == other.side &&
        tradeTimestamp == other.tradeTimestamp &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, instrumentType.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, baseAsset.hashCode);
    _$hash = $jc(_$hash, quoteAsset.hashCode);
    _$hash = $jc(_$hash, tradeId.hashCode);
    _$hash = $jc(_$hash, price.hashCode);
    _$hash = $jc(_$hash, size.hashCode);
    _$hash = $jc(_$hash, side.hashCode);
    _$hash = $jc(_$hash, tradeTimestamp.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'MarketTradeResponseDto')
          ..add('id', id)
          ..add('exchange', exchange)
          ..add('instrumentType', instrumentType)
          ..add('symbol', symbol)
          ..add('baseAsset', baseAsset)
          ..add('quoteAsset', quoteAsset)
          ..add('tradeId', tradeId)
          ..add('price', price)
          ..add('size', size)
          ..add('side', side)
          ..add('tradeTimestamp', tradeTimestamp)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class MarketTradeResponseDtoBuilder
    implements Builder<MarketTradeResponseDto, MarketTradeResponseDtoBuilder> {
  _$MarketTradeResponseDto? _$v;

  num? _id;
  num? get id => _$this._id;
  set id(num? id) => _$this._id = id;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  MarketTradeResponseDtoInstrumentTypeEnum? _instrumentType;
  MarketTradeResponseDtoInstrumentTypeEnum? get instrumentType =>
      _$this._instrumentType;
  set instrumentType(
    MarketTradeResponseDtoInstrumentTypeEnum? instrumentType,
  ) => _$this._instrumentType = instrumentType;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _baseAsset;
  String? get baseAsset => _$this._baseAsset;
  set baseAsset(String? baseAsset) => _$this._baseAsset = baseAsset;

  String? _quoteAsset;
  String? get quoteAsset => _$this._quoteAsset;
  set quoteAsset(String? quoteAsset) => _$this._quoteAsset = quoteAsset;

  String? _tradeId;
  String? get tradeId => _$this._tradeId;
  set tradeId(String? tradeId) => _$this._tradeId = tradeId;

  String? _price;
  String? get price => _$this._price;
  set price(String? price) => _$this._price = price;

  String? _size;
  String? get size => _$this._size;
  set size(String? size) => _$this._size = size;

  MarketTradeResponseDtoSideEnum? _side;
  MarketTradeResponseDtoSideEnum? get side => _$this._side;
  set side(MarketTradeResponseDtoSideEnum? side) => _$this._side = side;

  String? _tradeTimestamp;
  String? get tradeTimestamp => _$this._tradeTimestamp;
  set tradeTimestamp(String? tradeTimestamp) =>
      _$this._tradeTimestamp = tradeTimestamp;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  MarketTradeResponseDtoBuilder() {
    MarketTradeResponseDto._defaults(this);
  }

  MarketTradeResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _exchange = $v.exchange;
      _instrumentType = $v.instrumentType;
      _symbol = $v.symbol;
      _baseAsset = $v.baseAsset;
      _quoteAsset = $v.quoteAsset;
      _tradeId = $v.tradeId;
      _price = $v.price;
      _size = $v.size;
      _side = $v.side;
      _tradeTimestamp = $v.tradeTimestamp;
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(MarketTradeResponseDto other) {
    _$v = other as _$MarketTradeResponseDto;
  }

  @override
  void update(void Function(MarketTradeResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  MarketTradeResponseDto build() => _build();

  _$MarketTradeResponseDto _build() {
    final _$result =
        _$v ??
        _$MarketTradeResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'MarketTradeResponseDto',
            'id',
          ),
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'MarketTradeResponseDto',
            'exchange',
          ),
          instrumentType: BuiltValueNullFieldError.checkNotNull(
            instrumentType,
            r'MarketTradeResponseDto',
            'instrumentType',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'MarketTradeResponseDto',
            'symbol',
          ),
          baseAsset: BuiltValueNullFieldError.checkNotNull(
            baseAsset,
            r'MarketTradeResponseDto',
            'baseAsset',
          ),
          quoteAsset: BuiltValueNullFieldError.checkNotNull(
            quoteAsset,
            r'MarketTradeResponseDto',
            'quoteAsset',
          ),
          tradeId: BuiltValueNullFieldError.checkNotNull(
            tradeId,
            r'MarketTradeResponseDto',
            'tradeId',
          ),
          price: BuiltValueNullFieldError.checkNotNull(
            price,
            r'MarketTradeResponseDto',
            'price',
          ),
          size: BuiltValueNullFieldError.checkNotNull(
            size,
            r'MarketTradeResponseDto',
            'size',
          ),
          side: BuiltValueNullFieldError.checkNotNull(
            side,
            r'MarketTradeResponseDto',
            'side',
          ),
          tradeTimestamp: BuiltValueNullFieldError.checkNotNull(
            tradeTimestamp,
            r'MarketTradeResponseDto',
            'tradeTimestamp',
          ),
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'MarketTradeResponseDto',
            'createdAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
