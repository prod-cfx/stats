// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_backtest_draft_config_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AiQuantConversationBacktestDraftConfigRequestDto
    extends AiQuantConversationBacktestDraftConfigRequestDto {
  @override
  final AiQuantConversationBacktestConfigResponseDto backtestDraftConfig;

  factory _$AiQuantConversationBacktestDraftConfigRequestDto([
    void Function(AiQuantConversationBacktestDraftConfigRequestDtoBuilder)?
    updates,
  ]) =>
      (AiQuantConversationBacktestDraftConfigRequestDtoBuilder()
            ..update(updates))
          ._build();

  _$AiQuantConversationBacktestDraftConfigRequestDto._({
    required this.backtestDraftConfig,
  }) : super._();
  @override
  AiQuantConversationBacktestDraftConfigRequestDto rebuild(
    void Function(AiQuantConversationBacktestDraftConfigRequestDtoBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationBacktestDraftConfigRequestDtoBuilder toBuilder() =>
      AiQuantConversationBacktestDraftConfigRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationBacktestDraftConfigRequestDto &&
        backtestDraftConfig == other.backtestDraftConfig;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, backtestDraftConfig.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AiQuantConversationBacktestDraftConfigRequestDto',
    )..add('backtestDraftConfig', backtestDraftConfig)).toString();
  }
}

class AiQuantConversationBacktestDraftConfigRequestDtoBuilder
    implements
        Builder<
          AiQuantConversationBacktestDraftConfigRequestDto,
          AiQuantConversationBacktestDraftConfigRequestDtoBuilder
        > {
  _$AiQuantConversationBacktestDraftConfigRequestDto? _$v;

  AiQuantConversationBacktestConfigResponseDtoBuilder? _backtestDraftConfig;
  AiQuantConversationBacktestConfigResponseDtoBuilder get backtestDraftConfig =>
      _$this._backtestDraftConfig ??=
          AiQuantConversationBacktestConfigResponseDtoBuilder();
  set backtestDraftConfig(
    AiQuantConversationBacktestConfigResponseDtoBuilder? backtestDraftConfig,
  ) => _$this._backtestDraftConfig = backtestDraftConfig;

  AiQuantConversationBacktestDraftConfigRequestDtoBuilder() {
    AiQuantConversationBacktestDraftConfigRequestDto._defaults(this);
  }

  AiQuantConversationBacktestDraftConfigRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _backtestDraftConfig = $v.backtestDraftConfig.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationBacktestDraftConfigRequestDto other) {
    _$v = other as _$AiQuantConversationBacktestDraftConfigRequestDto;
  }

  @override
  void update(
    void Function(AiQuantConversationBacktestDraftConfigRequestDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationBacktestDraftConfigRequestDto build() => _build();

  _$AiQuantConversationBacktestDraftConfigRequestDto _build() {
    _$AiQuantConversationBacktestDraftConfigRequestDto _$result;
    try {
      _$result =
          _$v ??
          _$AiQuantConversationBacktestDraftConfigRequestDto._(
            backtestDraftConfig: backtestDraftConfig.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'backtestDraftConfig';
        backtestDraftConfig.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AiQuantConversationBacktestDraftConfigRequestDto',
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
