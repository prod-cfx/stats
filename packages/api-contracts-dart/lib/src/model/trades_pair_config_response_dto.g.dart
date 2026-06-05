// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'trades_pair_config_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const TradesPairConfigResponseDtoInstrumentTypeEnum
_$tradesPairConfigResponseDtoInstrumentTypeEnum_SPOT =
    const TradesPairConfigResponseDtoInstrumentTypeEnum._('SPOT');
const TradesPairConfigResponseDtoInstrumentTypeEnum
_$tradesPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL =
    const TradesPairConfigResponseDtoInstrumentTypeEnum._('PERPETUAL');
const TradesPairConfigResponseDtoInstrumentTypeEnum
_$tradesPairConfigResponseDtoInstrumentTypeEnum_FUTURE =
    const TradesPairConfigResponseDtoInstrumentTypeEnum._('FUTURE');

TradesPairConfigResponseDtoInstrumentTypeEnum
_$tradesPairConfigResponseDtoInstrumentTypeEnumValueOf(String name) {
  switch (name) {
    case 'SPOT':
      return _$tradesPairConfigResponseDtoInstrumentTypeEnum_SPOT;
    case 'PERPETUAL':
      return _$tradesPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL;
    case 'FUTURE':
      return _$tradesPairConfigResponseDtoInstrumentTypeEnum_FUTURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<TradesPairConfigResponseDtoInstrumentTypeEnum>
_$tradesPairConfigResponseDtoInstrumentTypeEnumValues =
    BuiltSet<TradesPairConfigResponseDtoInstrumentTypeEnum>(
      const <TradesPairConfigResponseDtoInstrumentTypeEnum>[
        _$tradesPairConfigResponseDtoInstrumentTypeEnum_SPOT,
        _$tradesPairConfigResponseDtoInstrumentTypeEnum_PERPETUAL,
        _$tradesPairConfigResponseDtoInstrumentTypeEnum_FUTURE,
      ],
    );

Serializer<TradesPairConfigResponseDtoInstrumentTypeEnum>
_$tradesPairConfigResponseDtoInstrumentTypeEnumSerializer =
    _$TradesPairConfigResponseDtoInstrumentTypeEnumSerializer();

class _$TradesPairConfigResponseDtoInstrumentTypeEnumSerializer
    implements
        PrimitiveSerializer<TradesPairConfigResponseDtoInstrumentTypeEnum> {
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
    TradesPairConfigResponseDtoInstrumentTypeEnum,
  ];
  @override
  final String wireName = 'TradesPairConfigResponseDtoInstrumentTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    TradesPairConfigResponseDtoInstrumentTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  TradesPairConfigResponseDtoInstrumentTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => TradesPairConfigResponseDtoInstrumentTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$TradesPairConfigResponseDto extends TradesPairConfigResponseDto {
  @override
  final String id;
  @override
  final String pairId;
  @override
  final String exchange;
  @override
  final String symbol;
  @override
  final String baseAsset;
  @override
  final String quoteAsset;
  @override
  final TradesPairConfigResponseDtoInstrumentTypeEnum instrumentType;
  @override
  final String? canonicalInstId;
  @override
  final bool enabled;
  @override
  final num priority;
  @override
  final JsonObject? metadata;
  @override
  final String? description;
  @override
  final String createdAt;
  @override
  final String updatedAt;

  factory _$TradesPairConfigResponseDto([
    void Function(TradesPairConfigResponseDtoBuilder)? updates,
  ]) => (TradesPairConfigResponseDtoBuilder()..update(updates))._build();

  _$TradesPairConfigResponseDto._({
    required this.id,
    required this.pairId,
    required this.exchange,
    required this.symbol,
    required this.baseAsset,
    required this.quoteAsset,
    required this.instrumentType,
    this.canonicalInstId,
    required this.enabled,
    required this.priority,
    this.metadata,
    this.description,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  TradesPairConfigResponseDto rebuild(
    void Function(TradesPairConfigResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  TradesPairConfigResponseDtoBuilder toBuilder() =>
      TradesPairConfigResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is TradesPairConfigResponseDto &&
        id == other.id &&
        pairId == other.pairId &&
        exchange == other.exchange &&
        symbol == other.symbol &&
        baseAsset == other.baseAsset &&
        quoteAsset == other.quoteAsset &&
        instrumentType == other.instrumentType &&
        canonicalInstId == other.canonicalInstId &&
        enabled == other.enabled &&
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
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, baseAsset.hashCode);
    _$hash = $jc(_$hash, quoteAsset.hashCode);
    _$hash = $jc(_$hash, instrumentType.hashCode);
    _$hash = $jc(_$hash, canonicalInstId.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
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
    return (newBuiltValueToStringHelper(r'TradesPairConfigResponseDto')
          ..add('id', id)
          ..add('pairId', pairId)
          ..add('exchange', exchange)
          ..add('symbol', symbol)
          ..add('baseAsset', baseAsset)
          ..add('quoteAsset', quoteAsset)
          ..add('instrumentType', instrumentType)
          ..add('canonicalInstId', canonicalInstId)
          ..add('enabled', enabled)
          ..add('priority', priority)
          ..add('metadata', metadata)
          ..add('description', description)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class TradesPairConfigResponseDtoBuilder
    implements
        Builder<
          TradesPairConfigResponseDto,
          TradesPairConfigResponseDtoBuilder
        > {
  _$TradesPairConfigResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _pairId;
  String? get pairId => _$this._pairId;
  set pairId(String? pairId) => _$this._pairId = pairId;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _baseAsset;
  String? get baseAsset => _$this._baseAsset;
  set baseAsset(String? baseAsset) => _$this._baseAsset = baseAsset;

  String? _quoteAsset;
  String? get quoteAsset => _$this._quoteAsset;
  set quoteAsset(String? quoteAsset) => _$this._quoteAsset = quoteAsset;

  TradesPairConfigResponseDtoInstrumentTypeEnum? _instrumentType;
  TradesPairConfigResponseDtoInstrumentTypeEnum? get instrumentType =>
      _$this._instrumentType;
  set instrumentType(
    TradesPairConfigResponseDtoInstrumentTypeEnum? instrumentType,
  ) => _$this._instrumentType = instrumentType;

  String? _canonicalInstId;
  String? get canonicalInstId => _$this._canonicalInstId;
  set canonicalInstId(String? canonicalInstId) =>
      _$this._canonicalInstId = canonicalInstId;

  bool? _enabled;
  bool? get enabled => _$this._enabled;
  set enabled(bool? enabled) => _$this._enabled = enabled;

  num? _priority;
  num? get priority => _$this._priority;
  set priority(num? priority) => _$this._priority = priority;

  JsonObject? _metadata;
  JsonObject? get metadata => _$this._metadata;
  set metadata(JsonObject? metadata) => _$this._metadata = metadata;

  String? _description;
  String? get description => _$this._description;
  set description(String? description) => _$this._description = description;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  TradesPairConfigResponseDtoBuilder() {
    TradesPairConfigResponseDto._defaults(this);
  }

  TradesPairConfigResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _pairId = $v.pairId;
      _exchange = $v.exchange;
      _symbol = $v.symbol;
      _baseAsset = $v.baseAsset;
      _quoteAsset = $v.quoteAsset;
      _instrumentType = $v.instrumentType;
      _canonicalInstId = $v.canonicalInstId;
      _enabled = $v.enabled;
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
  void replace(TradesPairConfigResponseDto other) {
    _$v = other as _$TradesPairConfigResponseDto;
  }

  @override
  void update(void Function(TradesPairConfigResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  TradesPairConfigResponseDto build() => _build();

  _$TradesPairConfigResponseDto _build() {
    final _$result =
        _$v ??
        _$TradesPairConfigResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'TradesPairConfigResponseDto',
            'id',
          ),
          pairId: BuiltValueNullFieldError.checkNotNull(
            pairId,
            r'TradesPairConfigResponseDto',
            'pairId',
          ),
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'TradesPairConfigResponseDto',
            'exchange',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'TradesPairConfigResponseDto',
            'symbol',
          ),
          baseAsset: BuiltValueNullFieldError.checkNotNull(
            baseAsset,
            r'TradesPairConfigResponseDto',
            'baseAsset',
          ),
          quoteAsset: BuiltValueNullFieldError.checkNotNull(
            quoteAsset,
            r'TradesPairConfigResponseDto',
            'quoteAsset',
          ),
          instrumentType: BuiltValueNullFieldError.checkNotNull(
            instrumentType,
            r'TradesPairConfigResponseDto',
            'instrumentType',
          ),
          canonicalInstId: canonicalInstId,
          enabled: BuiltValueNullFieldError.checkNotNull(
            enabled,
            r'TradesPairConfigResponseDto',
            'enabled',
          ),
          priority: BuiltValueNullFieldError.checkNotNull(
            priority,
            r'TradesPairConfigResponseDto',
            'priority',
          ),
          metadata: metadata,
          description: description,
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'TradesPairConfigResponseDto',
            'createdAt',
          ),
          updatedAt: BuiltValueNullFieldError.checkNotNull(
            updatedAt,
            r'TradesPairConfigResponseDto',
            'updatedAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
