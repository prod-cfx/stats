// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_subscription_update_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const LlmSubscriptionUpdateRequestDtoStatusEnum
_$llmSubscriptionUpdateRequestDtoStatusEnum_active =
    const LlmSubscriptionUpdateRequestDtoStatusEnum._('active');
const LlmSubscriptionUpdateRequestDtoStatusEnum
_$llmSubscriptionUpdateRequestDtoStatusEnum_paused =
    const LlmSubscriptionUpdateRequestDtoStatusEnum._('paused');
const LlmSubscriptionUpdateRequestDtoStatusEnum
_$llmSubscriptionUpdateRequestDtoStatusEnum_cancelled =
    const LlmSubscriptionUpdateRequestDtoStatusEnum._('cancelled');

LlmSubscriptionUpdateRequestDtoStatusEnum
_$llmSubscriptionUpdateRequestDtoStatusEnumValueOf(String name) {
  switch (name) {
    case 'active':
      return _$llmSubscriptionUpdateRequestDtoStatusEnum_active;
    case 'paused':
      return _$llmSubscriptionUpdateRequestDtoStatusEnum_paused;
    case 'cancelled':
      return _$llmSubscriptionUpdateRequestDtoStatusEnum_cancelled;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<LlmSubscriptionUpdateRequestDtoStatusEnum>
_$llmSubscriptionUpdateRequestDtoStatusEnumValues =
    BuiltSet<LlmSubscriptionUpdateRequestDtoStatusEnum>(
      const <LlmSubscriptionUpdateRequestDtoStatusEnum>[
        _$llmSubscriptionUpdateRequestDtoStatusEnum_active,
        _$llmSubscriptionUpdateRequestDtoStatusEnum_paused,
        _$llmSubscriptionUpdateRequestDtoStatusEnum_cancelled,
      ],
    );

Serializer<LlmSubscriptionUpdateRequestDtoStatusEnum>
_$llmSubscriptionUpdateRequestDtoStatusEnumSerializer =
    _$LlmSubscriptionUpdateRequestDtoStatusEnumSerializer();

class _$LlmSubscriptionUpdateRequestDtoStatusEnumSerializer
    implements PrimitiveSerializer<LlmSubscriptionUpdateRequestDtoStatusEnum> {
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
    LlmSubscriptionUpdateRequestDtoStatusEnum,
  ];
  @override
  final String wireName = 'LlmSubscriptionUpdateRequestDtoStatusEnum';

  @override
  Object serialize(
    Serializers serializers,
    LlmSubscriptionUpdateRequestDtoStatusEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  LlmSubscriptionUpdateRequestDtoStatusEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => LlmSubscriptionUpdateRequestDtoStatusEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$LlmSubscriptionUpdateRequestDto
    extends LlmSubscriptionUpdateRequestDto {
  @override
  final LlmSubscriptionUpdateRequestDtoStatusEnum? status;
  @override
  final BuiltMap<String, JsonObject?>? customParams;
  @override
  final String? exchangeAccountId;

  factory _$LlmSubscriptionUpdateRequestDto([
    void Function(LlmSubscriptionUpdateRequestDtoBuilder)? updates,
  ]) => (LlmSubscriptionUpdateRequestDtoBuilder()..update(updates))._build();

  _$LlmSubscriptionUpdateRequestDto._({
    this.status,
    this.customParams,
    this.exchangeAccountId,
  }) : super._();
  @override
  LlmSubscriptionUpdateRequestDto rebuild(
    void Function(LlmSubscriptionUpdateRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmSubscriptionUpdateRequestDtoBuilder toBuilder() =>
      LlmSubscriptionUpdateRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmSubscriptionUpdateRequestDto &&
        status == other.status &&
        customParams == other.customParams &&
        exchangeAccountId == other.exchangeAccountId;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, status.hashCode);
    _$hash = $jc(_$hash, customParams.hashCode);
    _$hash = $jc(_$hash, exchangeAccountId.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LlmSubscriptionUpdateRequestDto')
          ..add('status', status)
          ..add('customParams', customParams)
          ..add('exchangeAccountId', exchangeAccountId))
        .toString();
  }
}

class LlmSubscriptionUpdateRequestDtoBuilder
    implements
        Builder<
          LlmSubscriptionUpdateRequestDto,
          LlmSubscriptionUpdateRequestDtoBuilder
        > {
  _$LlmSubscriptionUpdateRequestDto? _$v;

  LlmSubscriptionUpdateRequestDtoStatusEnum? _status;
  LlmSubscriptionUpdateRequestDtoStatusEnum? get status => _$this._status;
  set status(LlmSubscriptionUpdateRequestDtoStatusEnum? status) =>
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

  LlmSubscriptionUpdateRequestDtoBuilder() {
    LlmSubscriptionUpdateRequestDto._defaults(this);
  }

  LlmSubscriptionUpdateRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _status = $v.status;
      _customParams = $v.customParams?.toBuilder();
      _exchangeAccountId = $v.exchangeAccountId;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LlmSubscriptionUpdateRequestDto other) {
    _$v = other as _$LlmSubscriptionUpdateRequestDto;
  }

  @override
  void update(void Function(LlmSubscriptionUpdateRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LlmSubscriptionUpdateRequestDto build() => _build();

  _$LlmSubscriptionUpdateRequestDto _build() {
    _$LlmSubscriptionUpdateRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$LlmSubscriptionUpdateRequestDto._(
            status: status,
            customParams: _customParams?.build(),
            exchangeAccountId: exchangeAccountId,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'customParams';
        _customParams?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'LlmSubscriptionUpdateRequestDto',
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
