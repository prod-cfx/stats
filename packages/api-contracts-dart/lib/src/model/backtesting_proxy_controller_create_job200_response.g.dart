// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_proxy_controller_create_job200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingProxyControllerCreateJob200Response
    extends BacktestingProxyControllerCreateJob200Response {
  @override
  final BacktestingCreateJobResponseDto data;
  @override
  final String? message;

  factory _$BacktestingProxyControllerCreateJob200Response([
    void Function(BacktestingProxyControllerCreateJob200ResponseBuilder)?
    updates,
  ]) =>
      (BacktestingProxyControllerCreateJob200ResponseBuilder()..update(updates))
          ._build();

  _$BacktestingProxyControllerCreateJob200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  BacktestingProxyControllerCreateJob200Response rebuild(
    void Function(BacktestingProxyControllerCreateJob200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingProxyControllerCreateJob200ResponseBuilder toBuilder() =>
      BacktestingProxyControllerCreateJob200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingProxyControllerCreateJob200Response &&
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
            r'BacktestingProxyControllerCreateJob200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class BacktestingProxyControllerCreateJob200ResponseBuilder
    implements
        Builder<
          BacktestingProxyControllerCreateJob200Response,
          BacktestingProxyControllerCreateJob200ResponseBuilder
        > {
  _$BacktestingProxyControllerCreateJob200Response? _$v;

  BacktestingCreateJobResponseDtoBuilder? _data;
  BacktestingCreateJobResponseDtoBuilder get data =>
      _$this._data ??= BacktestingCreateJobResponseDtoBuilder();
  set data(BacktestingCreateJobResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  BacktestingProxyControllerCreateJob200ResponseBuilder() {
    BacktestingProxyControllerCreateJob200Response._defaults(this);
  }

  BacktestingProxyControllerCreateJob200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingProxyControllerCreateJob200Response other) {
    _$v = other as _$BacktestingProxyControllerCreateJob200Response;
  }

  @override
  void update(
    void Function(BacktestingProxyControllerCreateJob200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingProxyControllerCreateJob200Response build() => _build();

  _$BacktestingProxyControllerCreateJob200Response _build() {
    _$BacktestingProxyControllerCreateJob200Response _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingProxyControllerCreateJob200Response._(
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
          r'BacktestingProxyControllerCreateJob200Response',
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
