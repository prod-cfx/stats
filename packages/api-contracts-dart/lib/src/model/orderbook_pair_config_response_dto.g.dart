// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'orderbook_pair_config_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const OrderbookPairConfigResponseDtoVenueTypeEnum
_$orderbookPairConfigResponseDtoVenueTypeEnum_CEX =
    const OrderbookPairConfigResponseDtoVenueTypeEnum._('CEX');
const OrderbookPairConfigResponseDtoVenueTypeEnum
_$orderbookPairConfigResponseDtoVenueTypeEnum_DEX =
    const OrderbookPairConfigResponseDtoVenueTypeEnum._('DEX');

OrderbookPairConfigResponseDtoVenueTypeEnum
_$orderbookPairConfigResponseDtoVenueTypeEnumValueOf(String name) {
  switch (name) {
    case 'CEX':
      return _$orderbookPairConfigResponseDtoVenueTypeEnum_CEX;
    case 'DEX':
      return _$orderbookPairConfigResponseDtoVenueTypeEnum_DEX;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<OrderbookPairConfigResponseDtoVenueTypeEnum>
_$orderbookPairConfigResponseDtoVenueTypeEnumValues =
    BuiltSet<OrderbookPairConfigResponseDtoVenueTypeEnum>(
      const <OrderbookPairConfigResponseDtoVenueTypeEnum>[
        _$orderbookPairConfigResponseDtoVenueTypeEnum_CEX,
        _$orderbookPairConfigResponseDtoVenueTypeEnum_DEX,
      ],
    );

const OrderbookPairConfigResponseDtoInstrumentTypeEnum
_$orderbookPairConfigResponseDtoInstrumentTypeEnum_SPOT =
    const OrderbookPairConfigResponseDtoInstrumentTypeEnum._('SPOT');
const OrderbookPairConfigResponseDtoInstrumentTypeEnum
_$orderbookPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL =
    const OrderbookPairConfigResponseDtoInstrumentTypeEnum._('PERPETUAL');
const OrderbookPairConfigResponseDtoInstrumentTypeEnum
_$orderbookPairConfigResponseDtoInstrumentTypeEnum_FUTURE =
    const OrderbookPairConfigResponseDtoInstrumentTypeEnum._('FUTURE');

OrderbookPairConfigResponseDtoInstrumentTypeEnum
_$orderbookPairConfigResponseDtoInstrumentTypeEnumValueOf(String name) {
  switch (name) {
    case 'SPOT':
      return _$orderbookPairConfigResponseDtoInstrumentTypeEnum_SPOT;
    case 'PERPETUAL':
      return _$orderbookPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL;
    case 'FUTURE':
      return _$orderbookPairConfigResponseDtoInstrumentTypeEnum_FUTURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<OrderbookPairConfigResponseDtoInstrumentTypeEnum>
_$orderbookPairConfigResponseDtoInstrumentTypeEnumValues =
    BuiltSet<OrderbookPairConfigResponseDtoInstrumentTypeEnum>(
      const <OrderbookPairConfigResponseDtoInstrumentTypeEnum>[
        _$orderbookPairConfigResponseDtoInstrumentTypeEnum_SPOT,
        _$orderbookPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL,
        _$orderbookPairConfigResponseDtoInstrumentTypeEnum_FUTURE,
      ],
    );

Serializer<OrderbookPairConfigResponseDtoVenueTypeEnum>
_$orderbookPairConfigResponseDtoVenueTypeEnumSerializer =
    _$OrderbookPairConfigResponseDtoVenueTypeEnumSerializer();
Serializer<OrderbookPairConfigResponseDtoInstrumentTypeEnum>
_$orderbookPairConfigResponseDtoInstrumentTypeEnumSerializer =
    _$OrderbookPairConfigResponseDtoInstrumentTypeEnumSerializer();

class _$OrderbookPairConfigResponseDtoVenueTypeEnumSerializer
    implements
        PrimitiveSerializer<OrderbookPairConfigResponseDtoVenueTypeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'CEX': 'CEX',
    'DEX': 'DEX',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'CEX': 'CEX',
    'DEX': 'DEX',
  };

  @override
  final Iterable<Type> types = const <Type>[
    OrderbookPairConfigResponseDtoVenueTypeEnum,
  ];
  @override
  final String wireName = 'OrderbookPairConfigResponseDtoVenueTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    OrderbookPairConfigResponseDtoVenueTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  OrderbookPairConfigResponseDtoVenueTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => OrderbookPairConfigResponseDtoVenueTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$OrderbookPairConfigResponseDtoInstrumentTypeEnumSerializer
    implements
        PrimitiveSerializer<OrderbookPairConfigResponseDtoInstrumentTypeEnum> {
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
    OrderbookPairConfigResponseDtoInstrumentTypeEnum,
  ];
  @override
  final String wireName = 'OrderbookPairConfigResponseDtoInstrumentTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    OrderbookPairConfigResponseDtoInstrumentTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  OrderbookPairConfigResponseDtoInstrumentTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => OrderbookPairConfigResponseDtoInstrumentTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$OrderbookPairConfigResponseDto extends OrderbookPairConfigResponseDto {
  @override
  final String id;
  @override
  final String pairId;
  @override
  final String venue;
  @override
  final String symbol;
  @override
  final String baseAsset;
  @override
  final String quoteAsset;
  @override
  final OrderbookPairConfigResponseDtoVenueTypeEnum venueType;
  @override
  final OrderbookPairConfigResponseDtoInstrumentTypeEnum instrumentType;
  @override
  final bool enabled;
  @override
  final num? pullIntervalSeconds;
  @override
  final num? depthLevels;
  @override
  final num priority;
  @override
  final JsonObject? metadata;
  @override
  final String? description;
  @override
  final DateTime createdAt;
  @override
  final DateTime updatedAt;

  factory _$OrderbookPairConfigResponseDto([
    void Function(OrderbookPairConfigResponseDtoBuilder)? updates,
  ]) => (OrderbookPairConfigResponseDtoBuilder()..update(updates))._build();

  _$OrderbookPairConfigResponseDto._({
    required this.id,
    required this.pairId,
    required this.venue,
    required this.symbol,
    required this.baseAsset,
    required this.quoteAsset,
    required this.venueType,
    required this.instrumentType,
    required this.enabled,
    this.pullIntervalSeconds,
    this.depthLevels,
    required this.priority,
    this.metadata,
    this.description,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  OrderbookPairConfigResponseDto rebuild(
    void Function(OrderbookPairConfigResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OrderbookPairConfigResponseDtoBuilder toBuilder() =>
      OrderbookPairConfigResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OrderbookPairConfigResponseDto &&
        id == other.id &&
        pairId == other.pairId &&
        venue == other.venue &&
        symbol == other.symbol &&
        baseAsset == other.baseAsset &&
        quoteAsset == other.quoteAsset &&
        venueType == other.venueType &&
        instrumentType == other.instrumentType &&
        enabled == other.enabled &&
        pullIntervalSeconds == other.pullIntervalSeconds &&
        depthLevels == other.depthLevels &&
        priority == other.priority &&
        metadata == other.metadata &&
        description == other.description &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, pairId.hashCode);
    _$hash = $jc(_$hash, venue.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, baseAsset.hashCode);
    _$hash = $jc(_$hash, quoteAsset.hashCode);
    _$hash = $jc(_$hash, venueType.hashCode);
    _$hash = $jc(_$hash, instrumentType.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, pullIntervalSeconds.hashCode);
    _$hash = $jc(_$hash, depthLevels.hashCode);
    _$hash = $jc(_$hash, priority.hashCode);
    _$hash = $jc(_$hash, metadata.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'OrderbookPairConfigResponseDto')
          ..add('id', id)
          ..add('pairId', pairId)
          ..add('venue', venue)
          ..add('symbol', symbol)
          ..add('baseAsset', baseAsset)
          ..add('quoteAsset', quoteAsset)
          ..add('venueType', venueType)
          ..add('instrumentType', instrumentType)
          ..add('enabled', enabled)
          ..add('pullIntervalSeconds', pullIntervalSeconds)
          ..add('depthLevels', depthLevels)
          ..add('priority', priority)
          ..add('metadata', metadata)
          ..add('description', description)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class OrderbookPairConfigResponseDtoBuilder
    implements
        Builder<
          OrderbookPairConfigResponseDto,
          OrderbookPairConfigResponseDtoBuilder
        > {
  _$OrderbookPairConfigResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _pairId;
  String? get pairId => _$this._pairId;
  set pairId(String? pairId) => _$this._pairId = pairId;

  String? _venue;
  String? get venue => _$this._venue;
  set venue(String? venue) => _$this._venue = venue;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _baseAsset;
  String? get baseAsset => _$this._baseAsset;
  set baseAsset(String? baseAsset) => _$this._baseAsset = baseAsset;

  String? _quoteAsset;
  String? get quoteAsset => _$this._quoteAsset;
  set quoteAsset(String? quoteAsset) => _$this._quoteAsset = quoteAsset;

  OrderbookPairConfigResponseDtoVenueTypeEnum? _venueType;
  OrderbookPairConfigResponseDtoVenueTypeEnum? get venueType =>
      _$this._venueType;
  set venueType(OrderbookPairConfigResponseDtoVenueTypeEnum? venueType) =>
      _$this._venueType = venueType;

  OrderbookPairConfigResponseDtoInstrumentTypeEnum? _instrumentType;
  OrderbookPairConfigResponseDtoInstrumentTypeEnum? get instrumentType =>
      _$this._instrumentType;
  set instrumentType(
    OrderbookPairConfigResponseDtoInstrumentTypeEnum? instrumentType,
  ) => _$this._instrumentType = instrumentType;

  bool? _enabled;
  bool? get enabled => _$this._enabled;
  set enabled(bool? enabled) => _$this._enabled = enabled;

  num? _pullIntervalSeconds;
  num? get pullIntervalSeconds => _$this._pullIntervalSeconds;
  set pullIntervalSeconds(num? pullIntervalSeconds) =>
      _$this._pullIntervalSeconds = pullIntervalSeconds;

  num? _depthLevels;
  num? get depthLevels => _$this._depthLevels;
  set depthLevels(num? depthLevels) => _$this._depthLevels = depthLevels;

  num? _priority;
  num? get priority => _$this._priority;
  set priority(num? priority) => _$this._priority = priority;

  JsonObject? _metadata;
  JsonObject? get metadata => _$this._metadata;
  set metadata(JsonObject? metadata) => _$this._metadata = metadata;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  DateTime? _updatedAt;
  DateTime? get updatedAt => _$this._updatedAt;
  set updatedAt(DateTime? updatedAt) => _$this._updatedAt = updatedAt;

  OrderbookPairConfigResponseDtoBuilder() {
    OrderbookPairConfigResponseDto._defaults(this);
  }

  OrderbookPairConfigResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _pairId = $v.pairId;
      _venue = $v.venue;
      _symbol = $v.symbol;
      _baseAsset = $v.baseAsset;
      _quoteAsset = $v.quoteAsset;
      _venueType = $v.venueType;
      _instrumentType = $v.instrumentType;
      _enabled = $v.enabled;
      _pullIntervalSeconds = $v.pullIntervalSeconds;
      _depthLevels = $v.depthLevels;
      _priority = $v.priority;
      _metadata = $v.metadata;
      _description = $v.description;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(OrderbookPairConfigResponseDto other) {
    _$v = other as _$OrderbookPairConfigResponseDto;
  }

  @override
  void update(void Function(OrderbookPairConfigResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  OrderbookPairConfigResponseDto build() => _build();

  _$OrderbookPairConfigResponseDto _build() {
    final _$result =
        _$v ??
        _$OrderbookPairConfigResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'OrderbookPairConfigResponseDto',
            'id',
          ),
          pairId: BuiltValueNullFieldError.checkNotNull(
            pairId,
            r'OrderbookPairConfigResponseDto',
            'pairId',
          ),
          venue: BuiltValueNullFieldError.checkNotNull(
            venue,
            r'OrderbookPairConfigResponseDto',
            'venue',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'OrderbookPairConfigResponseDto',
            'symbol',
          ),
          baseAsset: BuiltValueNullFieldError.checkNotNull(
            baseAsset,
            r'OrderbookPairConfigResponseDto',
            'baseAsset',
          ),
          quoteAsset: BuiltValueNullFieldError.checkNotNull(
            quoteAsset,
            r'OrderbookPairConfigResponseDto',
            'quoteAsset',
          ),
          venueType: BuiltValueNullFieldError.checkNotNull(
            venueType,
            r'OrderbookPairConfigResponseDto',
            'venueType',
          ),
          instrumentType: BuiltValueNullFieldError.checkNotNull(
            instrumentType,
            r'OrderbookPairConfigResponseDto',
            'instrumentType',
          ),
          enabled: BuiltValueNullFieldError.checkNotNull(
            enabled,
            r'OrderbookPairConfigResponseDto',
            'enabled',
          ),
          pullIntervalSeconds: pullIntervalSeconds,
          depthLevels: depthLevels,
          priority: BuiltValueNullFieldError.checkNotNull(
            priority,
            r'OrderbookPairConfigResponseDto',
            'priority',
          ),
          metadata: metadata,
          description: description,
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'OrderbookPairConfigResponseDto',
            'createdAt',
          ),
          updatedAt: BuiltValueNullFieldError.checkNotNull(
            updatedAt,
            r'OrderbookPairConfigResponseDto',
            'updatedAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
