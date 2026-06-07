// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_subscription_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LlmSubscriptionResponseDtoStatusEnum
_$llmSubscriptionResponseDtoStatusEnum_active =
    const LlmSubscriptionResponseDtoStatusEnum._('active');
const LlmSubscriptionResponseDtoStatusEnum
_$llmSubscriptionResponseDtoStatusEnum_paused =
    const LlmSubscriptionResponseDtoStatusEnum._('paused');
const LlmSubscriptionResponseDtoStatusEnum
_$llmSubscriptionResponseDtoStatusEnum_cancelled =
    const LlmSubscriptionResponseDtoStatusEnum._('cancelled');

LlmSubscriptionResponseDtoStatusEnum
_$llmSubscriptionResponseDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'active':
      return _$llmSubscriptionResponseDtoStatusEnum_active;
    case 'paused':
      return _$llmSubscriptionResponseDtoStatusEnum_paused;
    case 'cancelled':
      return _$llmSubscriptionResponseDtoStatusEnum_cancelled;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LlmSubscriptionResponseDtoStatusEnum>
_$llmSubscriptionResponseDtoStatusEnumValues =
    BuiltSet<LlmSubscriptionResponseDtoStatusEnum>(
      const <LlmSubscriptionResponseDtoStatusEnum>[
        _$llmSubscriptionResponseDtoStatusEnum_active,
        _$llmSubscriptionResponseDtoStatusEnum_paused,
        _$llmSubscriptionResponseDtoStatusEnum_cancelled,
      ],
    );

Serializer<LlmSubscriptionResponseDtoStatusEnum>
_$llmSubscriptionResponseDtoStatusEnumSerializer =
    _$LlmSubscriptionResponseDtoStatusEnumSerializer();

class _$LlmSubscriptionResponseDtoStatusEnumSerializer
    implements PrimitiveSerializer<LlmSubscriptionResponseDtoStatusEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'active': 'active',
    'paused': 'paused',
    'cancelled': 'cancelled',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'active': 'active',
    'paused': 'paused',
    'cancelled': 'cancelled',
  };

  @override
  final Iterable<Type> types = const <Type>[
    LlmSubscriptionResponseDtoStatusEnum,
  ];
  @override
  final String wireName = 'LlmSubscriptionResponseDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    LlmSubscriptionResponseDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LlmSubscriptionResponseDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LlmSubscriptionResponseDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LlmSubscriptionResponseDto extends LlmSubscriptionResponseDto {
  @override
  final String id;
  @override
  final String userId;
  @override
  final String llmStrategyInstanceId;
  @override
  final String llmStrategyInstanceName;
  @override
  final String llmStrategyName;
  @override
  final String? llmStrategyDescription;
  @override
  final LlmSubscriptionResponseDtoStatusEnum status;
  @override
  final BuiltMap<String, JsonObject?>? customParams;
  @override
  final String? exchangeAccountId;
  @override
  final String? exchangeId;
  @override
  final String? exchangeName;
  @override
  final String subscribedAt;
  @override
  final String? unsubscribedAt;
  @override
  final String createdAt;
  @override
  final String updatedAt;

  factory _$LlmSubscriptionResponseDto([
    void Function(LlmSubscriptionResponseDtoBuilder)? updates,
  ]) => (LlmSubscriptionResponseDtoBuilder()..update(updates))._build();

  _$LlmSubscriptionResponseDto._({
    required this.id,
    required this.userId,
    required this.llmStrategyInstanceId,
    required this.llmStrategyInstanceName,
    required this.llmStrategyName,
    this.llmStrategyDescription,
    required this.status,
    this.customParams,
    this.exchangeAccountId,
    this.exchangeId,
    this.exchangeName,
    required this.subscribedAt,
    this.unsubscribedAt,
    required this.createdAt,
    required this.updatedAt,
  }) : super._();
  @override
  LlmSubscriptionResponseDto rebuild(
    void Function(LlmSubscriptionResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmSubscriptionResponseDtoBuilder toBuilder() =>
      LlmSubscriptionResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmSubscriptionResponseDto &&
        id == other.id &&
        userId == other.userId &&
        llmStrategyInstanceId == other.llmStrategyInstanceId &&
        llmStrategyInstanceName == other.llmStrategyInstanceName &&
        llmStrategyName == other.llmStrategyName &&
        llmStrategyDescription == other.llmStrategyDescription &&
        status == other.status &&
        customParams == other.customParams &&
        exchangeAccountId == other.exchangeAccountId &&
        exchangeId == other.exchangeId &&
        exchangeName == other.exchangeName &&
        subscribedAt == other.subscribedAt &&
        unsubscribedAt == other.unsubscribedAt &&
        createdAt == other.createdAt &&
        updatedAt == other.updatedAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, userId.hashCode);
    _$hash = $jc(_$hash, llmStrategyInstanceId.hashCode);
    _$hash = $jc(_$hash, llmStrategyInstanceName.hashCode);
    _$hash = $jc(_$hash, llmStrategyName.hashCode);
    _$hash = $jc(_$hash, llmStrategyDescription.hashCode);
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, customParams.hashCode);
    _$hash = $jc(_$hash, exchangeAccountId.hashCode);
    _$hash = $jc(_$hash, exchangeId.hashCode);
    _$hash = $jc(_$hash, exchangeName.hashCode);
    _$hash = $jc(_$hash, subscribedAt.hashCode);
    _$hash = $jc(_$hash, unsubscribedAt.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jc(_$hash, updatedAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LlmSubscriptionResponseDto')
          ..add('id', id)
          ..add('userId', userId)
          ..add('llmStrategyInstanceId', llmStrategyInstanceId)
          ..add('llmStrategyInstanceName', llmStrategyInstanceName)
          ..add('llmStrategyName', llmStrategyName)
          ..add('llmStrategyDescription', llmStrategyDescription)
          ..add('status', status)
          ..add('customParams', customParams)
          ..add('exchangeAccountId', exchangeAccountId)
          ..add('exchangeId', exchangeId)
          ..add('exchangeName', exchangeName)
          ..add('subscribedAt', subscribedAt)
          ..add('unsubscribedAt', unsubscribedAt)
          ..add('createdAt', createdAt)
          ..add('updatedAt', updatedAt))
        .toString();
  }
}

class LlmSubscriptionResponseDtoBuilder
    implements
        Builder<LlmSubscriptionResponseDto, LlmSubscriptionResponseDtoBuilder> {
  _$LlmSubscriptionResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _userId;
  String? get userId => _$this._userId;
  set userId(String? userId) => _$this._userId = userId;

  String? _llmStrategyInstanceId;
  String? get llmStrategyInstanceId => _$this._llmStrategyInstanceId;
  set llmStrategyInstanceId(String? llmStrategyInstanceId) =>
      _$this._llmStrategyInstanceId = llmStrategyInstanceId;

  String? _llmStrategyInstanceName;
  String? get llmStrategyInstanceName => _$this._llmStrategyInstanceName;
  set llmStrategyInstanceName(String? llmStrategyInstanceName) =>
      _$this._llmStrategyInstanceName = llmStrategyInstanceName;

  String? _llmStrategyName;
  String? get llmStrategyName => _$this._llmStrategyName;
  set llmStrategyName(String? llmStrategyName) =>
      _$this._llmStrategyName = llmStrategyName;

  String? _llmStrategyDescription;
  String? get llmStrategyDescription => _$this._llmStrategyDescription;
  set llmStrategyDescription(String? llmStrategyDescription) =>
      _$this._llmStrategyDescription = llmStrategyDescription;

  LlmSubscriptionResponseDtoStatusEnum? _status;
  LlmSubscriptionResponseDtoStatusEnum? get status => _$this._status;
  set status(LlmSubscriptionResponseDtoStatusEnum? status) =>
      _$this._status = status;

  MapBuilder<String, JsonObject?>? _customParams;
  MapBuilder<String, JsonObject?> get customParams =>
      _$this._customParams ??= MapBuilder<String, JsonObject?>();
  set customParams(MapBuilder<String, JsonObject?>? customParams) =>
      _$this._customParams = customParams;

  String? _exchangeAccountId;
  String? get exchangeAccountId => _$this._exchangeAccountId;
  set exchangeAccountId(String? exchangeAccountId) =>
      _$this._exchangeAccountId = exchangeAccountId;

  String? _exchangeId;
  String? get exchangeId => _$this._exchangeId;
  set exchangeId(String? exchangeId) => _$this._exchangeId = exchangeId;

  String? _exchangeName;
  String? get exchangeName => _$this._exchangeName;
  set exchangeName(String? exchangeName) => _$this._exchangeName = exchangeName;

  String? _subscribedAt;
  String? get subscribedAt => _$this._subscribedAt;
  set subscribedAt(String? subscribedAt) => _$this._subscribedAt = subscribedAt;

  String? _unsubscribedAt;
  String? get unsubscribedAt => _$this._unsubscribedAt;
  set unsubscribedAt(String? unsubscribedAt) =>
      _$this._unsubscribedAt = unsubscribedAt;

  String? _createdAt;
  String? get createdAt => _$this._createdAt;
  set createdAt(String? createdAt) => _$this._createdAt = createdAt;

  String? _updatedAt;
  String? get updatedAt => _$this._updatedAt;
  set updatedAt(String? updatedAt) => _$this._updatedAt = updatedAt;

  LlmSubscriptionResponseDtoBuilder() {
    LlmSubscriptionResponseDto._defaults(this);
  }

  LlmSubscriptionResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _userId = $v.userId;
      _llmStrategyInstanceId = $v.llmStrategyInstanceId;
      _llmStrategyInstanceName = $v.llmStrategyInstanceName;
      _llmStrategyName = $v.llmStrategyName;
      _llmStrategyDescription = $v.llmStrategyDescription;
      _status = $v.status;
      _customParams = $v.customParams?.toBuilder();
      _exchangeAccountId = $v.exchangeAccountId;
      _exchangeId = $v.exchangeId;
      _exchangeName = $v.exchangeName;
      _subscribedAt = $v.subscribedAt;
      _unsubscribedAt = $v.unsubscribedAt;
      _createdAt = $v.createdAt;
      _updatedAt = $v.updatedAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LlmSubscriptionResponseDto other) {
    _$v = other as _$LlmSubscriptionResponseDto;
  }

  @override
  void update(void Function(LlmSubscriptionResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LlmSubscriptionResponseDto build() => _build();

  _$LlmSubscriptionResponseDto _build() {
    _$LlmSubscriptionResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$LlmSubscriptionResponseDto._(
            id: BuiltValueNullFieldError.checkNotNull(
              id,
              r'LlmSubscriptionResponseDto',
              'id',
            ),
            userId: BuiltValueNullFieldError.checkNotNull(
              userId,
              r'LlmSubscriptionResponseDto',
              'userId',
            ),
            llmStrategyInstanceId: BuiltValueNullFieldError.checkNotNull(
              llmStrategyInstanceId,
              r'LlmSubscriptionResponseDto',
              'llmStrategyInstanceId',
            ),
            llmStrategyInstanceName: BuiltValueNullFieldError.checkNotNull(
              llmStrategyInstanceName,
              r'LlmSubscriptionResponseDto',
              'llmStrategyInstanceName',
            ),
            llmStrategyName: BuiltValueNullFieldError.checkNotNull(
              llmStrategyName,
              r'LlmSubscriptionResponseDto',
              'llmStrategyName',
            ),
            llmStrategyDescription: llmStrategyDescription,
            status: BuiltValueNullFieldError.checkNotNull(
              status,
              r'LlmSubscriptionResponseDto',
              'status',
            ),
            customParams: _customParams?.build(),
            exchangeAccountId: exchangeAccountId,
            exchangeId: exchangeId,
            exchangeName: exchangeName,
            subscribedAt: BuiltValueNullFieldError.checkNotNull(
              subscribedAt,
              r'LlmSubscriptionResponseDto',
              'subscribedAt',
            ),
            unsubscribedAt: unsubscribedAt,
            createdAt: BuiltValueNullFieldError.checkNotNull(
              createdAt,
              r'LlmSubscriptionResponseDto',
              'createdAt',
            ),
            updatedAt: BuiltValueNullFieldError.checkNotNull(
              updatedAt,
              r'LlmSubscriptionResponseDto',
              'updatedAt',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'customParams';
        _customParams?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'LlmSubscriptionResponseDto',
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
