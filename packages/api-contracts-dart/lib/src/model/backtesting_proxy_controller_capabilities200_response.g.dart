// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_proxy_controller_capabilities200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingProxyControllerCapabilities200Response
    extends BacktestingProxyControllerCapabilities200Response {
  @override
  final BacktestingCapabilitiesResponseDto data;
  @override
  final String? message;

  factory _$BacktestingProxyControllerCapabilities200Response([
    void Function(BacktestingProxyControllerCapabilities200ResponseBuilder)?
    updates,
  ]) =>
      (BacktestingProxyControllerCapabilities200ResponseBuilder()
            ..update(updates))
          ._build();

  _$BacktestingProxyControllerCapabilities200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  BacktestingProxyControllerCapabilities200Response rebuild(
    void Function(BacktestingProxyControllerCapabilities200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingProxyControllerCapabilities200ResponseBuilder toBuilder() =>
      BacktestingProxyControllerCapabilities200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingProxyControllerCapabilities200Response &&
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
            r'BacktestingProxyControllerCapabilities200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class BacktestingProxyControllerCapabilities200ResponseBuilder
    implements
        Builder<
          BacktestingProxyControllerCapabilities200Response,
          BacktestingProxyControllerCapabilities200ResponseBuilder
        > {
  _$BacktestingProxyControllerCapabilities200Response? _$v;

  BacktestingCapabilitiesResponseDtoBuilder? _data;
  BacktestingCapabilitiesResponseDtoBuilder get data =>
      _$this._data ??= BacktestingCapabilitiesResponseDtoBuilder();
  set data(BacktestingCapabilitiesResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  BacktestingProxyControllerCapabilities200ResponseBuilder() {
    BacktestingProxyControllerCapabilities200Response._defaults(this);
  }

  BacktestingProxyControllerCapabilities200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingProxyControllerCapabilities200Response other) {
    _$v = other as _$BacktestingProxyControllerCapabilities200Response;
  }

  @override
  void update(
    void Function(BacktestingProxyControllerCapabilities200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingProxyControllerCapabilities200Response build() => _build();

  _$BacktestingProxyControllerCapabilities200Response _build() {
    _$BacktestingProxyControllerCapabilities200Response _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingProxyControllerCapabilities200Response._(
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
          r'BacktestingProxyControllerCapabilities200Response',
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
