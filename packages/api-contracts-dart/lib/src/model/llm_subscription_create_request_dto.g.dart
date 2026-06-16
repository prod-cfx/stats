// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_subscription_create_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$LlmSubscriptionCreateRequestDto
    extends LlmSubscriptionCreateRequestDto {
  @override
  final String llmStrategyInstanceId;
  @override
  final BuiltMap<String, JsonObject?>? customParams;
  @override
  final String exchangeAccountId;

  factory _$LlmSubscriptionCreateRequestDto([
    void Function(LlmSubscriptionCreateRequestDtoBuilder)? updates,
  ]) => (LlmSubscriptionCreateRequestDtoBuilder()..update(updates))._build();

  _$LlmSubscriptionCreateRequestDto._({
    required this.llmStrategyInstanceId,
    this.customParams,
    required this.exchangeAccountId,
  }) : super._();
  @override
  LlmSubscriptionCreateRequestDto rebuild(
    void Function(LlmSubscriptionCreateRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmSubscriptionCreateRequestDtoBuilder toBuilder() =>
      LlmSubscriptionCreateRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmSubscriptionCreateRequestDto &&
        llmStrategyInstanceId == other.llmStrategyInstanceId &&
        customParams == other.customParams &&
        exchangeAccountId == other.exchangeAccountId;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, llmStrategyInstanceId.hashCode);
    _$hash = $jc(_$hash, customParams.hashCode);
    _$hash = $jc(_$hash, exchangeAccountId.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'LlmSubscriptionCreateRequestDto')
          ..add('llmStrategyInstanceId', llmStrategyInstanceId)
          ..add('customParams', customParams)
          ..add('exchangeAccountId', exchangeAccountId))
        .toString();
  }
}

class LlmSubscriptionCreateRequestDtoBuilder
    implements
        Builder<
          LlmSubscriptionCreateRequestDto,
          LlmSubscriptionCreateRequestDtoBuilder
        > {
  _$LlmSubscriptionCreateRequestDto? _$v;

  String? _llmStrategyInstanceId;
  String? get llmStrategyInstanceId => _$this._llmStrategyInstanceId;
  set llmStrategyInstanceId(String? llmStrategyInstanceId) =>
      _$this._llmStrategyInstanceId = llmStrategyInstanceId;

  MapBuilder<String, JsonObject?>? _customParams;
  MapBuilder<String, JsonObject?> get customParams =>
      _$this._customParams ??= MapBuilder<String, JsonObject?>();
  set customParams(MapBuilder<String, JsonObject?>? customParams) =>
      _$this._customParams = customParams;

  String? _exchangeAccountId;
  String? get exchangeAccountId => _$this._exchangeAccountId;
  set exchangeAccountId(String? exchangeAccountId) =>
      _$this._exchangeAccountId = exchangeAccountId;

  LlmSubscriptionCreateRequestDtoBuilder() {
    LlmSubscriptionCreateRequestDto._defaults(this);
  }

  LlmSubscriptionCreateRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _llmStrategyInstanceId = $v.llmStrategyInstanceId;
      _customParams = $v.customParams?.toBuilder();
      _exchangeAccountId = $v.exchangeAccountId;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LlmSubscriptionCreateRequestDto other) {
    _$v = other as _$LlmSubscriptionCreateRequestDto;
  }

  @override
  void update(void Function(LlmSubscriptionCreateRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  LlmSubscriptionCreateRequestDto build() => _build();

  _$LlmSubscriptionCreateRequestDto _build() {
    _$LlmSubscriptionCreateRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$LlmSubscriptionCreateRequestDto._(
            llmStrategyInstanceId: BuiltValueNullFieldError.checkNotNull(
              llmStrategyInstanceId,
              r'LlmSubscriptionCreateRequestDto',
              'llmStrategyInstanceId',
            ),
            customParams: _customParams?.build(),
            exchangeAccountId: BuiltValueNullFieldError.checkNotNull(
              exchangeAccountId,
              r'LlmSubscriptionCreateRequestDto',
              'exchangeAccountId',
            ),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'customParams';
        _customParams?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'LlmSubscriptionCreateRequestDto',
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
