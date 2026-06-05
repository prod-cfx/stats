// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_orderbook_pair_config_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CreateOrderbookPairConfigDtoVenueTypeEnum
_$createOrderbookPairConfigDtoVenueTypeEnum_CEX =
    const CreateOrderbookPairConfigDtoVenueTypeEnum._('CEX');
const CreateOrderbookPairConfigDtoVenueTypeEnum
_$createOrderbookPairConfigDtoVenueTypeEnum_DEX =
    const CreateOrderbookPairConfigDtoVenueTypeEnum._('DEX');

CreateOrderbookPairConfigDtoVenueTypeEnum
_$createOrderbookPairConfigDtoVenueTypeEnumValueOf(String name) {
  switch (name) {
    case 'CEX':
      return _$createOrderbookPairConfigDtoVenueTypeEnum_CEX;
    case 'DEX':
      return _$createOrderbookPairConfigDtoVenueTypeEnum_DEX;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateOrderbookPairConfigDtoVenueTypeEnum>
_$createOrderbookPairConfigDtoVenueTypeEnumValues =
    BuiltSet<CreateOrderbookPairConfigDtoVenueTypeEnum>(
      const <CreateOrderbookPairConfigDtoVenueTypeEnum>[
        _$createOrderbookPairConfigDtoVenueTypeEnum_CEX,
        _$createOrderbookPairConfigDtoVenueTypeEnum_DEX,
      ],
    );

const CreateOrderbookPairConfigDtoInstrumentTypeEnum
_$createOrderbookPairConfigDtoInstrumentTypeEnum_SPOT =
    const CreateOrderbookPairConfigDtoInstrumentTypeEnum._('SPOT');
const CreateOrderbookPairConfigDtoInstrumentTypeEnum
_$createOrderbookPairConfigDtoInstrumentTypeEnum_PERPETUAL =
    const CreateOrderbookPairConfigDtoInstrumentTypeEnum._('PERPETUAL');
const CreateOrderbookPairConfigDtoInstrumentTypeEnum
_$createOrderbookPairConfigDtoInstrumentTypeEnum_FUTURE =
    const CreateOrderbookPairConfigDtoInstrumentTypeEnum._('FUTURE');

CreateOrderbookPairConfigDtoInstrumentTypeEnum
_$createOrderbookPairConfigDtoInstrumentTypeEnumValueOf(String name) {
  switch (name) {
    case 'SPOT':
      return _$createOrderbookPairConfigDtoInstrumentTypeEnum_SPOT;
    case 'PERPETUAL':
      return _$createOrderbookPairConfigDtoInstrumentTypeEnum_PERPETUAL;
    case 'FUTURE':
      return _$createOrderbookPairConfigDtoInstrumentTypeEnum_FUTURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateOrderbookPairConfigDtoInstrumentTypeEnum>
_$createOrderbookPairConfigDtoInstrumentTypeEnumValues =
    BuiltSet<CreateOrderbookPairConfigDtoInstrumentTypeEnum>(
      const <CreateOrderbookPairConfigDtoInstrumentTypeEnum>[
        _$createOrderbookPairConfigDtoInstrumentTypeEnum_SPOT,
        _$createOrderbookPairConfigDtoInstrumentTypeEnum_PERPETUAL,
        _$createOrderbookPairConfigDtoInstrumentTypeEnum_FUTURE,
      ],
    );

Serializer<CreateOrderbookPairConfigDtoVenueTypeEnum>
_$createOrderbookPairConfigDtoVenueTypeEnumSerializer =
    _$CreateOrderbookPairConfigDtoVenueTypeEnumSerializer();
Serializer<CreateOrderbookPairConfigDtoInstrumentTypeEnum>
_$createOrderbookPairConfigDtoInstrumentTypeEnumSerializer =
    _$CreateOrderbookPairConfigDtoInstrumentTypeEnumSerializer();

class _$CreateOrderbookPairConfigDtoVenueTypeEnumSerializer
    implements PrimitiveSerializer<CreateOrderbookPairConfigDtoVenueTypeEnum> {
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
    CreateOrderbookPairConfigDtoVenueTypeEnum,
  ];
  @override
  final String wireName = 'CreateOrderbookPairConfigDtoVenueTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateOrderbookPairConfigDtoVenueTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateOrderbookPairConfigDtoVenueTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateOrderbookPairConfigDtoVenueTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateOrderbookPairConfigDtoInstrumentTypeEnumSerializer
    implements
        PrimitiveSerializer<CreateOrderbookPairConfigDtoInstrumentTypeEnum> {
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
    CreateOrderbookPairConfigDtoInstrumentTypeEnum,
  ];
  @override
  final String wireName = 'CreateOrderbookPairConfigDtoInstrumentTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateOrderbookPairConfigDtoInstrumentTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateOrderbookPairConfigDtoInstrumentTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateOrderbookPairConfigDtoInstrumentTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateOrderbookPairConfigDto extends CreateOrderbookPairConfigDto {
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
  final CreateOrderbookPairConfigDtoVenueTypeEnum venueType;
  @override
  final CreateOrderbookPairConfigDtoInstrumentTypeEnum instrumentType;
  @override
  final bool? enabled;
  @override
  final num? pullIntervalSeconds;
  @override
  final num? depthLevels;
  @override
  final num? priority;
  @override
  final JsonObject? metadata;
  @override
  final String? description;

  factory _$CreateOrderbookPairConfigDto([
    void Function(CreateOrderbookPairConfigDtoBuilder)? updates,
  ]) => (CreateOrderbookPairConfigDtoBuilder()..update(updates))._build();

  _$CreateOrderbookPairConfigDto._({
    required this.pairId,
    required this.venue,
    required this.symbol,
    required this.baseAsset,
    required this.quoteAsset,
    required this.venueType,
    required this.instrumentType,
    this.enabled,
    this.pullIntervalSeconds,
    this.depthLevels,
    this.priority,
    this.metadata,
    this.description,
  }) : super._();
  @override
  CreateOrderbookPairConfigDto rebuild(
    void Function(CreateOrderbookPairConfigDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateOrderbookPairConfigDtoBuilder toBuilder() =>
      CreateOrderbookPairConfigDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateOrderbookPairConfigDto &&
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
        description == other.description;
  }

  @override
  int get hashCode {
    var _$hash = 0;
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
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateOrderbookPairConfigDto')
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
          ..add('description', description))
        .toString();
  }
}

class CreateOrderbookPairConfigDtoBuilder
    implements
        Builder<
          CreateOrderbookPairConfigDto,
          CreateOrderbookPairConfigDtoBuilder
        > {
  _$CreateOrderbookPairConfigDto? _$v;

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

  CreateOrderbookPairConfigDtoVenueTypeEnum? _venueType;
  CreateOrderbookPairConfigDtoVenueTypeEnum? get venueType => _$this._venueType;
  set venueType(CreateOrderbookPairConfigDtoVenueTypeEnum? venueType) =>
      _$this._venueType = venueType;

  CreateOrderbookPairConfigDtoInstrumentTypeEnum? _instrumentType;
  CreateOrderbookPairConfigDtoInstrumentTypeEnum? get instrumentType =>
      _$this._instrumentType;
  set instrumentType(
    CreateOrderbookPairConfigDtoInstrumentTypeEnum? instrumentType,
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

  CreateOrderbookPairConfigDtoBuilder() {
    CreateOrderbookPairConfigDto._defaults(this);
  }

  CreateOrderbookPairConfigDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
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
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateOrderbookPairConfigDto other) {
    _$v = other as _$CreateOrderbookPairConfigDto;
  }

  @override
  void update(void Function(CreateOrderbookPairConfigDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateOrderbookPairConfigDto build() => _build();

  _$CreateOrderbookPairConfigDto _build() {
    final _$result =
        _$v ??
        _$CreateOrderbookPairConfigDto._(
          pairId: BuiltValueNullFieldError.checkNotNull(
            pairId,
            r'CreateOrderbookPairConfigDto',
            'pairId',
          ),
          venue: BuiltValueNullFieldError.checkNotNull(
            venue,
            r'CreateOrderbookPairConfigDto',
            'venue',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'CreateOrderbookPairConfigDto',
            'symbol',
          ),
          baseAsset: BuiltValueNullFieldError.checkNotNull(
            baseAsset,
            r'CreateOrderbookPairConfigDto',
            'baseAsset',
          ),
          quoteAsset: BuiltValueNullFieldError.checkNotNull(
            quoteAsset,
            r'CreateOrderbookPairConfigDto',
            'quoteAsset',
          ),
          venueType: BuiltValueNullFieldError.checkNotNull(
            venueType,
            r'CreateOrderbookPairConfigDto',
            'venueType',
          ),
          instrumentType: BuiltValueNullFieldError.checkNotNull(
            instrumentType,
            r'CreateOrderbookPairConfigDto',
            'instrumentType',
          ),
          enabled: enabled,
          pullIntervalSeconds: pullIntervalSeconds,
          depthLevels: depthLevels,
          priority: priority,
          metadata: metadata,
          description: description,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
