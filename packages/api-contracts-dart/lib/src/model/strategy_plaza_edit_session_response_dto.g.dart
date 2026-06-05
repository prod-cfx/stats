// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_edit_session_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaEditSessionResponseDto
    extends StrategyPlazaEditSessionResponseDto {
  @override
  final String sessionId;
  @override
  final String templateId;
  @override
  final String initialMessage;

  factory _$StrategyPlazaEditSessionResponseDto([
    void Function(StrategyPlazaEditSessionResponseDtoBuilder)? updates,
  ]) =>
      (StrategyPlazaEditSessionResponseDtoBuilder()..update(updates))._build();

  _$StrategyPlazaEditSessionResponseDto._({
    required this.sessionId,
    required this.templateId,
    required this.initialMessage,
  }) : super._();
  @override
  StrategyPlazaEditSessionResponseDto rebuild(
    void Function(StrategyPlazaEditSessionResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaEditSessionResponseDtoBuilder toBuilder() =>
      StrategyPlazaEditSessionResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaEditSessionResponseDto &&
        sessionId == other.sessionId &&
        templateId == other.templateId &&
        initialMessage == other.initialMessage;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, sessionId.hashCode);
    _$hash = $jc(_$hash, templateId.hashCode);
    _$hash = $jc(_$hash, initialMessage.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'StrategyPlazaEditSessionResponseDto')
          ..add('sessionId', sessionId)
          ..add('templateId', templateId)
          ..add('initialMessage', initialMessage))
        .toString();
  }
}

class StrategyPlazaEditSessionResponseDtoBuilder
    implements
        Builder<
          StrategyPlazaEditSessionResponseDto,
          StrategyPlazaEditSessionResponseDtoBuilder
        > {
  _$StrategyPlazaEditSessionResponseDto? _$v;

  String? _sessionId;
  String? get sessionId => _$this._sessionId;
  set sessionId(String? sessionId) => _$this._sessionId = sessionId;

  String? _templateId;
  String? get templateId => _$this._templateId;
  set templateId(String? templateId) => _$this._templateId = templateId;

  String? _initialMessage;
  String? get initialMessage => _$this._initialMessage;
  set initialMessage(String? initialMessage) =>
      _$this._initialMessage = initialMessage;

  StrategyPlazaEditSessionResponseDtoBuilder() {
    StrategyPlazaEditSessionResponseDto._defaults(this);
  }

  StrategyPlazaEditSessionResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _sessionId = $v.sessionId;
      _templateId = $v.templateId;
      _initialMessage = $v.initialMessage;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaEditSessionResponseDto other) {
    _$v = other as _$StrategyPlazaEditSessionResponseDto;
  }

  @override
  void update(
    void Function(StrategyPlazaEditSessionResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaEditSessionResponseDto build() => _build();

  _$StrategyPlazaEditSessionResponseDto _build() {
    final _$result =
        _$v ??
        _$StrategyPlazaEditSessionResponseDto._(
          sessionId: BuiltValueNullFieldError.checkNotNull(
            sessionId,
            r'StrategyPlazaEditSessionResponseDto',
            'sessionId',
          ),
          templateId: BuiltValueNullFieldError.checkNotNull(
            templateId,
            r'StrategyPlazaEditSessionResponseDto',
            'templateId',
          ),
          initialMessage: BuiltValueNullFieldError.checkNotNull(
            initialMessage,
            r'StrategyPlazaEditSessionResponseDto',
            'initialMessage',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
