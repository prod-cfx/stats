// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_trades_pair_config_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CreateTradesPairConfigDtoInstrumentTypeEnum
_$createTradesPairConfigDtoInstrumentTypeEnum_SPOT =
    const CreateTradesPairConfigDtoInstrumentTypeEnum._('SPOT');
const CreateTradesPairConfigDtoInstrumentTypeEnum
_$createTradesPairConfigDtoInstrumentTypeEnum_PERPETUAL =
    const CreateTradesPairConfigDtoInstrumentTypeEnum._('PERPETUAL');
const CreateTradesPairConfigDtoInstrumentTypeEnum
_$createTradesPairConfigDtoInstrumentTypeEnum_FUTURE =
    const CreateTradesPairConfigDtoInstrumentTypeEnum._('FUTURE');

CreateTradesPairConfigDtoInstrumentTypeEnum
_$createTradesPairConfigDtoInstrumentTypeEnumValueOf(String name) {
  switch (name) {
    case 'SPOT':
      return _$createTradesPairConfigDtoInstrumentTypeEnum_SPOT;
    case 'PERPETUAL':
      return _$createTradesPairConfigDtoInstrumentTypeEnum_PERPETUAL;
    case 'FUTURE':
      return _$createTradesPairConfigDtoInstrumentTypeEnum_FUTURE;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CreateTradesPairConfigDtoInstrumentTypeEnum>
_$createTradesPairConfigDtoInstrumentTypeEnumValues =
    BuiltSet<CreateTradesPairConfigDtoInstrumentTypeEnum>(
      const <CreateTradesPairConfigDtoInstrumentTypeEnum>[
        _$createTradesPairConfigDtoInstrumentTypeEnum_SPOT,
        _$createTradesPairConfigDtoInstrumentTypeEnum_PERPETUAL,
        _$createTradesPairConfigDtoInstrumentTypeEnum_FUTURE,
      ],
    );

Serializer<CreateTradesPairConfigDtoInstrumentTypeEnum>
_$createTradesPairConfigDtoInstrumentTypeEnumSerializer =
    _$CreateTradesPairConfigDtoInstrumentTypeEnumSerializer();

class _$CreateTradesPairConfigDtoInstrumentTypeEnumSerializer
    implements
        PrimitiveSerializer<CreateTradesPairConfigDtoInstrumentTypeEnum> {
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
    CreateTradesPairConfigDtoInstrumentTypeEnum,
  ];
  @override
  final String wireName = 'CreateTradesPairConfigDtoInstrumentTypeEnum';

  @override
  Object serialize(
    Serializers serializers,
    CreateTradesPairConfigDtoInstrumentTypeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CreateTradesPairConfigDtoInstrumentTypeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CreateTradesPairConfigDtoInstrumentTypeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CreateTradesPairConfigDto extends CreateTradesPairConfigDto {
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
  final CreateTradesPairConfigDtoInstrumentTypeEnum instrumentType;
  @override
  final bool? enabled;
  @override
  final num? priority;
  @override
  final JsonObject? metadata;
  @override
  final String? description;

  factory _$CreateTradesPairConfigDto([
    void Function(CreateTradesPairConfigDtoBuilder)? updates,
  ]) => (CreateTradesPairConfigDtoBuilder()..update(updates))._build();

  _$CreateTradesPairConfigDto._({
    required this.pairId,
    required this.exchange,
    required this.symbol,
    required this.baseAsset,
    required this.quoteAsset,
    required this.instrumentType,
    this.enabled,
    this.priority,
    this.metadata,
    this.description,
  }) : super._();
  @override
  CreateTradesPairConfigDto rebuild(
    void Function(CreateTradesPairConfigDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateTradesPairConfigDtoBuilder toBuilder() =>
      CreateTradesPairConfigDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateTradesPairConfigDto &&
        pairId == other.pairId &&
        exchange == other.exchange &&
        symbol == other.symbol &&
        baseAsset == other.baseAsset &&
        quoteAsset == other.quoteAsset &&
        instrumentType == other.instrumentType &&
        enabled == other.enabled &&
        priority == other.priority &&
        metadata == other.metadata &&
        description == other.description;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, pairId.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, baseAsset.hashCode);
    _$hash = $jc(_$hash, quoteAsset.hashCode);
    _$hash = $jc(_$hash, instrumentType.hashCode);
    _$hash = $jc(_$hash, enabled.hashCode);
    _$hash = $jc(_$hash, priority.hashCode);
    _$hash = $jc(_$hash, metadata.hashCode);
    _$hash = $jc(_$hash, description.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateTradesPairConfigDto')
          ..add('pairId', pairId)
          ..add('exchange', exchange)
          ..add('symbol', symbol)
          ..add('baseAsset', baseAsset)
          ..add('quoteAsset', quoteAsset)
          ..add('instrumentType', instrumentType)
          ..add('enabled', enabled)
          ..add('priority', priority)
          ..add('metadata', metadata)
          ..add('description', description))
        .toString();
  }
}

class CreateTradesPairConfigDtoBuilder
    implements
        Builder<CreateTradesPairConfigDto, CreateTradesPairConfigDtoBuilder> {
  _$CreateTradesPairConfigDto? _$v;

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

  CreateTradesPairConfigDtoInstrumentTypeEnum? _instrumentType;
  CreateTradesPairConfigDtoInstrumentTypeEnum? get instrumentType =>
      _$this._instrumentType;
  set instrumentType(
    CreateTradesPairConfigDtoInstrumentTypeEnum? instrumentType,
  ) => _$this._instrumentType = instrumentType;

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

  CreateTradesPairConfigDtoBuilder() {
    CreateTradesPairConfigDto._defaults(this);
  }

  CreateTradesPairConfigDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _pairId = $v.pairId;
      _exchange = $v.exchange;
      _symbol = $v.symbol;
      _baseAsset = $v.baseAsset;
      _quoteAsset = $v.quoteAsset;
      _instrumentType = $v.instrumentType;
      _enabled = $v.enabled;
      _priority = $v.priority;
      _metadata = $v.metadata;
      _description = $v.description;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateTradesPairConfigDto other) {
    _$v = other as _$CreateTradesPairConfigDto;
  }

  @override
  void update(void Function(CreateTradesPairConfigDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateTradesPairConfigDto build() => _build();

  _$CreateTradesPairConfigDto _build() {
    final _$result =
        _$v ??
        _$CreateTradesPairConfigDto._(
          pairId: BuiltValueNullFieldError.checkNotNull(
            pairId,
            r'CreateTradesPairConfigDto',
            'pairId',
          ),
          exchange: BuiltValueNullFieldError.checkNotNull(
            exchange,
            r'CreateTradesPairConfigDto',
            'exchange',
          ),
          symbol: BuiltValueNullFieldError.checkNotNull(
            symbol,
            r'CreateTradesPairConfigDto',
            'symbol',
          ),
          baseAsset: BuiltValueNullFieldError.checkNotNull(
            baseAsset,
            r'CreateTradesPairConfigDto',
            'baseAsset',
          ),
          quoteAsset: BuiltValueNullFieldError.checkNotNull(
            quoteAsset,
            r'CreateTradesPairConfigDto',
            'quoteAsset',
          ),
          instrumentType: BuiltValueNullFieldError.checkNotNull(
            instrumentType,
            r'CreateTradesPairConfigDto',
            'instrumentType',
          ),
          enabled: enabled,
          priority: priority,
          metadata: metadata,
          description: description,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
