// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_strategies_controller_deploy_result200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AccountAiQuantStrategiesControllerDeployResult200Response
    extends AccountAiQuantStrategiesControllerDeployResult200Response {
  @override
  final AccountAiQuantStrategyDetailResponseDto? data;
  @override
  final String? message;

  factory _$AccountAiQuantStrategiesControllerDeployResult200Response([
    void Function(
      AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AccountAiQuantStrategiesControllerDeployResult200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AccountAiQuantStrategiesControllerDeployResult200Response rebuild(
    void Function(
      AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder
  toBuilder() =>
      AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantStrategiesControllerDeployResult200Response &&
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
            r'AccountAiQuantStrategiesControllerDeployResult200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder
    implements
        Builder<
          AccountAiQuantStrategiesControllerDeployResult200Response,
          AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder
        > {
  _$AccountAiQuantStrategiesControllerDeployResult200Response? _$v;

  AccountAiQuantStrategyDetailResponseDtoBuilder? _data;
  AccountAiQuantStrategyDetailResponseDtoBuilder get data =>
      _$this._data ??= AccountAiQuantStrategyDetailResponseDtoBuilder();
  set data(AccountAiQuantStrategyDetailResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder() {
    AccountAiQuantStrategiesControllerDeployResult200Response._defaults(this);
  }

  AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(
    AccountAiQuantStrategiesControllerDeployResult200Response other,
  ) {
    _$v = other as _$AccountAiQuantStrategiesControllerDeployResult200Response;
  }

  @override
  void update(
    void Function(
      AccountAiQuantStrategiesControllerDeployResult200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantStrategiesControllerDeployResult200Response build() => _build();

  _$AccountAiQuantStrategiesControllerDeployResult200Response _build() {
    _$AccountAiQuantStrategiesControllerDeployResult200Response _$result;
    try {
      _$result =
          _$v ??
          _$AccountAiQuantStrategiesControllerDeployResult200Response._(
            data: _data?.build(),
            message: message,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        _data?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AccountAiQuantStrategiesControllerDeployResult200Response',
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
