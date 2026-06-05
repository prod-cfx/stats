// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_update_execution_leverage_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AccountAiQuantUpdateExecutionLeverageRequestDto
    extends AccountAiQuantUpdateExecutionLeverageRequestDto {
  @override
  final num leverage;

  factory _$AccountAiQuantUpdateExecutionLeverageRequestDto([
    void Function(AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder)?
    updates,
  ]) =>
      (AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder()
            ..update(updates))
          ._build();

  _$AccountAiQuantUpdateExecutionLeverageRequestDto._({required this.leverage})
    : super._();
  @override
  AccountAiQuantUpdateExecutionLeverageRequestDto rebuild(
    void Function(AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder toBuilder() =>
      AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantUpdateExecutionLeverageRequestDto &&
        leverage == other.leverage;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, leverage.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AccountAiQuantUpdateExecutionLeverageRequestDto',
    )..add('leverage', leverage)).toString();
  }
}

class AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder
    implements
        Builder<
          AccountAiQuantUpdateExecutionLeverageRequestDto,
          AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder
        > {
  _$AccountAiQuantUpdateExecutionLeverageRequestDto? _$v;

  num? _leverage;
  num? get leverage => _$this._leverage;
  set leverage(num? leverage) => _$this._leverage = leverage;

  AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder() {
    AccountAiQuantUpdateExecutionLeverageRequestDto._defaults(this);
  }

  AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _leverage = $v.leverage;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountAiQuantUpdateExecutionLeverageRequestDto other) {
    _$v = other as _$AccountAiQuantUpdateExecutionLeverageRequestDto;
  }

  @override
  void update(
    void Function(AccountAiQuantUpdateExecutionLeverageRequestDtoBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantUpdateExecutionLeverageRequestDto build() => _build();

  _$AccountAiQuantUpdateExecutionLeverageRequestDto _build() {
    final _$result =
        _$v ??
        _$AccountAiQuantUpdateExecutionLeverageRequestDto._(
          leverage: BuiltValueNullFieldError.checkNotNull(
            leverage,
            r'AccountAiQuantUpdateExecutionLeverageRequestDto',
            'leverage',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
