// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_strategies_controller_detail200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AccountAiQuantStrategiesControllerDetail200Response
    extends AccountAiQuantStrategiesControllerDetail200Response {
  @override
  final AccountAiQuantStrategyDetailResponseDto data;
  @override
  final String? message;

  factory _$AccountAiQuantStrategiesControllerDetail200Response([
    void Function(AccountAiQuantStrategiesControllerDetail200ResponseBuilder)?
    updates,
  ]) =>
      (AccountAiQuantStrategiesControllerDetail200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AccountAiQuantStrategiesControllerDetail200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AccountAiQuantStrategiesControllerDetail200Response rebuild(
    void Function(AccountAiQuantStrategiesControllerDetail200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantStrategiesControllerDetail200ResponseBuilder toBuilder() =>
      AccountAiQuantStrategiesControllerDetail200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantStrategiesControllerDetail200Response &&
        data == other.data &&
        message == other.message;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, data.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AccountAiQuantStrategiesControllerDetail200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AccountAiQuantStrategiesControllerDetail200ResponseBuilder
    implements
        Builder<
          AccountAiQuantStrategiesControllerDetail200Response,
          AccountAiQuantStrategiesControllerDetail200ResponseBuilder
        > {
  _$AccountAiQuantStrategiesControllerDetail200Response? _$v;

  AccountAiQuantStrategyDetailResponseDtoBuilder? _data;
  AccountAiQuantStrategyDetailResponseDtoBuilder get data =>
      _$this._data ??= AccountAiQuantStrategyDetailResponseDtoBuilder();
  set data(AccountAiQuantStrategyDetailResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AccountAiQuantStrategiesControllerDetail200ResponseBuilder() {
    AccountAiQuantStrategiesControllerDetail200Response._defaults(this);
  }

  AccountAiQuantStrategiesControllerDetail200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AccountAiQuantStrategiesControllerDetail200Response other) {
    _$v = other as _$AccountAiQuantStrategiesControllerDetail200Response;
  }

  @override
  void update(
    void Function(AccountAiQuantStrategiesControllerDetail200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantStrategiesControllerDetail200Response build() => _build();

  _$AccountAiQuantStrategiesControllerDetail200Response _build() {
    _$AccountAiQuantStrategiesControllerDetail200Response _$result;
    try {
      _$result =
          _$v ??
          _$AccountAiQuantStrategiesControllerDetail200Response._(
            data: data.build(),
            message: message,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        data.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AccountAiQuantStrategiesControllerDetail200Response',
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
