// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_strategy_list_item_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AccountAiQuantStrategyListItemResponseDtoStatusEnum
_$accountAiQuantStrategyListItemResponseDtoStatusEnum_running =
    const AccountAiQuantStrategyListItemResponseDtoStatusEnum._('running');
const AccountAiQuantStrategyListItemResponseDtoStatusEnum
_$accountAiQuantStrategyListItemResponseDtoStatusEnum_stopped =
    const AccountAiQuantStrategyListItemResponseDtoStatusEnum._('stopped');
const AccountAiQuantStrategyListItemResponseDtoStatusEnum
_$accountAiQuantStrategyListItemResponseDtoStatusEnum_draft =
    const AccountAiQuantStrategyListItemResponseDtoStatusEnum._('draft');

AccountAiQuantStrategyListItemResponseDtoStatusEnum
_$accountAiQuantStrategyListItemResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'running':
      return _$accountAiQuantStrategyListItemResponseDtoStatusEnum_running;
    case 'stopped':
      return _$accountAiQuantStrategyListItemResponseDtoStatusEnum_stopped;
    case 'draft':
      return _$accountAiQuantStrategyListItemResponseDtoStatusEnum_draft;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AccountAiQuantStrategyListItemResponseDtoStatusEnum>
_$accountAiQuantStrategyListItemResponseDtoStatusEnumValues =
    BuiltSet<AccountAiQuantStrategyListItemResponseDtoStatusEnum>(
      const <AccountAiQuantStrategyListItemResponseDtoStatusEnum>[
        _$accountAiQuantStrategyListItemResponseDtoStatusEnum_running,
        _$accountAiQuantStrategyListItemResponseDtoStatusEnum_stopped,
        _$accountAiQuantStrategyListItemResponseDtoStatusEnum_draft,
      ],
    );

Serializer<AccountAiQuantStrategyListItemResponseDtoStatusEnum>
_$accountAiQuantStrategyListItemResponseDtoStatusEnumSerializer =
    _$AccountAiQuantStrategyListItemResponseDtoStatusEnumSerializer();

class _$AccountAiQuantStrategyListItemResponseDtoStatusEnumSerializer
    implements
        PrimitiveSerializer<
          AccountAiQuantStrategyListItemResponseDtoStatusEnum
        > {
  static const Map<String, Object> _toWire = const <String, Object>{
    'running': 'running',
    'stopped': 'stopped',
    'draft': 'draft',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'running': 'running',
    'stopped': 'stopped',
    'draft': 'draft',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AccountAiQuantStrategyListItemResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'AccountAiQuantStrategyListItemResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    AccountAiQuantStrategyListItemResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AccountAiQuantStrategyListItemResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AccountAiQuantStrategyListItemResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AccountAiQuantStrategyListItemResponseDto
    extends AccountAiQuantStrategyListItemResponseDto {
  @override
  final String id;
  @override
  final String name;
  @override
  final AccountAiQuantStrategyListItemResponseDtoStatusEnum status;
  @override
  final String? exchange;
  @override
  final String? symbol;
  @override
  final String? timeframe;
  @override
  final num? positionPct;
  @override
  final BuiltMap<String, JsonObject?>? paramSchema;
  @override
  final BuiltMap<String, JsonObject?>? paramValues;
  @override
  final String? schemaVersion;
  @override
  final bool isSubscribed;
  @override
  final BuiltMap<String, JsonObject?> metrics;
  @override
  final String updatedAt;

  factory _$AccountAiQuantStrategyListItemResponseDto([
    void Function(AccountAiQuantStrategyListItemResponseDtoBuilder)? updates,
  ]) => (AccountAiQuantStrategyListItemResponseDtoBuilder()..update(updates))
      ._build();

  _$AccountAiQuantStrategyListItemResponseDto._({
    required this.id,
    required this.name,
    required this.status,
    this.exchange,
    this.symbol,
    this.timeframe,
    this.positionPct,
    this.paramSchema,
    this.paramValues,
    this.schemaVersion,
    required this.isSubscribed,
    required this.metrics,
    required this.updatedAt,
  }) : super._();
  @override
  AccountAiQuantStrategyListItemResponseDto rebuild(
    void Function(AccountAiQuantStrategyListItemResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantStrategyListItemResponseDtoBuilder toBuilder() =>
      AccountAiQuantStrategyListItemResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantStrategyListItemResponseDto &&
        id == other.id &&
        name == other.name &&
        status == other.status &&
        exchange == other.exchange &&
        symbol == other.symbol &&
        timeframe == other.timeframe &&
        positionPct == other.positionPct &&
        paramSchema == other.paramSchema &&
        paramValues == other.paramValues &&
        schemaVersion == other.schemaVersion &&
        isSubscribed == other.isSubscribed &&
        metrics == other.metrics &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, name.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, exchange.hashCode);
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, timeframe.hashCode);
    _$hash = $jc(_$hash, positionPct.hashCode);
    _$hash = $jc(_$hash, paramSchema.hashCode);
    _$hash = $jc(_$hash, paramValues.hashCode);
    _$hash = $jc(_$hash, schemaVersion.hashCode);
    _$hash = $jc(_$hash, isSubscribed.hashCode);
    _$hash = $jc(_$hash, metrics.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AccountAiQuantStrategyListItemResponseDto',
          )
          ..add('id', id)
          ..add('name', name)
          ..add('status', status)
          ..add('exchange', exchange)
          ..add('symbol', symbol)
          ..add('timeframe', timeframe)
          ..add('positionPct', positionPct)
          ..add('paramSchema', paramSchema)
          ..add('paramValues', paramValues)
          ..add('schemaVersion', schemaVersion)
          ..add('isSubscribed', isSubscribed)
          ..add('metrics', metrics)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class AccountAiQuantStrategyListItemResponseDtoBuilder
    implements
        Builder<
          AccountAiQuantStrategyListItemResponseDto,
          AccountAiQuantStrategyListItemResponseDtoBuilder
        > {
  _$AccountAiQuantStrategyListItemResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _name;
  String? get name => _$this._name;
  set name(String? name) => _$this._name = name;

  AccountAiQuantStrategyListItemResponseDtoStatusEnum? _status;
  AccountAiQuantStrategyListItemResponseDtoStatusEnum? get status =>
      _$this._status;
  set status(AccountAiQuantStrategyListItemResponseDtoStatusEnum? status) =>
      _$this._status = status;

  String? _exchange;
  String? get exchange => _$this._exchange;
  set exchange(String? exchange) => _$this._exchange = exchange;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  String? _timeframe;
  String? get timeframe => _$this._timeframe;
  set timeframe(String? timeframe) => _$this._timeframe = timeframe;

  num? _positionPct;
  num? get positionPct => _$this._positionPct;
  set positionPct(num? positionPct) => _$this._positionPct = positionPct;

  MapBuilder<String, JsonObject?>? _paramSchema;
  MapBuilder<String, JsonObject?> get paramSchema =>
      _$this._paramSchema ??= MapBuilder<String, JsonObject?>();
  set paramSchema(MapBuilder<String, JsonObject?>? paramSchema) =>
      _$this._paramSchema = paramSchema;

  MapBuilder<String, JsonObject?>? _paramValues;
  MapBuilder<String, JsonObject?> get paramValues =>
      _$this._paramValues ??= MapBuilder<String, JsonObject?>();
  set paramValues(MapBuilder<String, JsonObject?>? paramValues) =>
      _$this._paramValues = paramValues;

  String? _schemaVersion;
  String? get schemaVersion => _$this._schemaVersion;
  set schemaVersion(String? schemaVersion) =>
      _$this._schemaVersion = schemaVersion;

  bool? _isSubscribed;
  bool? get isSubscribed => _$this._isSubscribed;
  set isSubscribed(bool? isSubscribed) => _$this._isSubscribed = isSubscribed;

  MapBuilder<String, JsonObject?>? _metrics;
  MapBuilder<String, JsonObject?> get metrics =>
      _$this._metrics ??= MapBuilder<String, JsonObject?>();
  set metrics(MapBuilder<String, JsonObject?>? metrics) =>
      _$this._metrics = metrics;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  AccountAiQuantStrategyListItemResponseDtoBuilder() {
    AccountAiQuantStrategyListItemResponseDto._defaults(this);
  }

  AccountAiQuantStrategyListItemResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _name = $v.name;
      _status = $v.status;
      _exchange = $v.exchange;
      _symbol = $v.symbol;
      _timeframe = $v.timeframe;
      _positionPct = $v.positionPct;
      _paramSchema = $v.paramSchema?.toBuilder();
      _paramValues = $v.paramValues?.toBuilder();
      _schemaVersion = $v.schemaVersion;
      _isSubscribed = $v.isSubscribed;
      _metrics = $v.metrics.toBuilder();
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountAiQuantStrategyListItemResponseDto other) {
    _$v = other as _$AccountAiQuantStrategyListItemResponseDto;
  }

  @override
  void update(
    void Function(AccountAiQuantStrategyListItemResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantStrategyListItemResponseDto build() => _build();

  _$AccountAiQuantStrategyListItemResponseDto _build() {
    _$AccountAiQuantStrategyListItemResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AccountAiQuantStrategyListItemResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'AccountAiQuantStrategyListItemResponseDto',
              'id',
            ),
            name: BuiltValueNullFieldError.checkNotNull(
              name,
              r'AccountAiQuantStrategyListItemResponseDto',
              'name',
            ),
            status: BuiltValueNullFieldError.checkNotNull(
              status,
              r'AccountAiQuantStrategyListItemResponseDto',
              'status',
            ),
            exchange: exchange,
            symbol: symbol,
            timeframe: timeframe,
            positionPct: positionPct,
            paramSchema: _paramSchema?.build(),
            paramValues: _paramValues?.build(),
            schemaVersion: schemaVersion,
            isSubscribed: BuiltValueNullFieldError.checkNotNull(
              isSubscribed,
              r'AccountAiQuantStrategyListItemResponseDto',
              'isSubscribed',
            ),
            metrics: metrics.build(),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'AccountAiQuantStrategyListItemResponseDto',
              'updatedAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'paramSchema';
        _paramSchema?.build();
        _$failedField = 'paramValues';
        _paramValues?.build();

        _$failedField = 'metrics';
        metrics.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AccountAiQuantStrategyListItemResponseDto',
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
