// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_backtest_config_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AiQuantConversationBacktestConfigResponseDto
    extends AiQuantConversationBacktestConfigResponseDto {
  @override
  final AiQuantConversationBacktestRangeResponseDto range;
  @override
  final AiQuantConversationBacktestExecutionResponseDto execution;

  factory _$AiQuantConversationBacktestConfigResponseDto([
    void Function(AiQuantConversationBacktestConfigResponseDtoBuilder)? updates,
  ]) => (AiQuantConversationBacktestConfigResponseDtoBuilder()..update(updates))
      ._build();

  _$AiQuantConversationBacktestConfigResponseDto._({
    required this.range,
    required this.execution,
  }) : super._();
  @override
  AiQuantConversationBacktestConfigResponseDto rebuild(
    void Function(AiQuantConversationBacktestConfigResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationBacktestConfigResponseDtoBuilder toBuilder() =>
      AiQuantConversationBacktestConfigResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationBacktestConfigResponseDto &&
        range == other.range &&
        execution == other.execution;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, range.hashCode);
    _$hash = $jc(_$hash, execution.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AiQuantConversationBacktestConfigResponseDto',
          )
          ..add('range', range)
          ..add('execution', execution))
        .toString();
  }
}

class AiQuantConversationBacktestConfigResponseDtoBuilder
    implements
        Builder<
          AiQuantConversationBacktestConfigResponseDto,
          AiQuantConversationBacktestConfigResponseDtoBuilder
        > {
  _$AiQuantConversationBacktestConfigResponseDto? _$v;

  AiQuantConversationBacktestRangeResponseDtoBuilder? _range;
  AiQuantConversationBacktestRangeResponseDtoBuilder get range =>
      _$this._range ??= AiQuantConversationBacktestRangeResponseDtoBuilder();
  set range(AiQuantConversationBacktestRangeResponseDtoBuilder? range) =>
      _$this._range = range;

  AiQuantConversationBacktestExecutionResponseDtoBuilder? _execution;
  AiQuantConversationBacktestExecutionResponseDtoBuilder get execution =>
      _$this._execution ??=
          AiQuantConversationBacktestExecutionResponseDtoBuilder();
  set execution(
    AiQuantConversationBacktestExecutionResponseDtoBuilder? execution,
  ) => _$this._execution = execution;

  AiQuantConversationBacktestConfigResponseDtoBuilder() {
    AiQuantConversationBacktestConfigResponseDto._defaults(this);
  }

  AiQuantConversationBacktestConfigResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _range = $v.range.toBuilder();
      _execution = $v.execution.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationBacktestConfigResponseDto other) {
    _$v = other as _$AiQuantConversationBacktestConfigResponseDto;
  }

  @override
  void update(
    void Function(AiQuantConversationBacktestConfigResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationBacktestConfigResponseDto build() => _build();

  _$AiQuantConversationBacktestConfigResponseDto _build() {
    _$AiQuantConversationBacktestConfigResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$AiQuantConversationBacktestConfigResponseDto._(
            range: range.build(),
            execution: execution.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'range';
        range.build();
        _$failedField = 'execution';
        execution.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AiQuantConversationBacktestConfigResponseDto',
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
