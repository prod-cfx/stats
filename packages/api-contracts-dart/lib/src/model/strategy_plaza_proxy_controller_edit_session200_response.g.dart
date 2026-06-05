// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_proxy_controller_edit_session200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaProxyControllerEditSession200Response
    extends StrategyPlazaProxyControllerEditSession200Response {
  @override
  final StrategyPlazaEditSessionResponseDto data;
  @override
  final String? message;

  factory _$StrategyPlazaProxyControllerEditSession200Response([
    void Function(StrategyPlazaProxyControllerEditSession200ResponseBuilder)?
    updates,
  ]) =>
      (StrategyPlazaProxyControllerEditSession200ResponseBuilder()
            ..update(updates))
          ._build();

  _$StrategyPlazaProxyControllerEditSession200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  StrategyPlazaProxyControllerEditSession200Response rebuild(
    void Function(StrategyPlazaProxyControllerEditSession200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaProxyControllerEditSession200ResponseBuilder toBuilder() =>
      StrategyPlazaProxyControllerEditSession200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaProxyControllerEditSession200Response &&
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
            r'StrategyPlazaProxyControllerEditSession200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class StrategyPlazaProxyControllerEditSession200ResponseBuilder
    implements
        Builder<
          StrategyPlazaProxyControllerEditSession200Response,
          StrategyPlazaProxyControllerEditSession200ResponseBuilder
        > {
  _$StrategyPlazaProxyControllerEditSession200Response? _$v;

  StrategyPlazaEditSessionResponseDtoBuilder? _data;
  StrategyPlazaEditSessionResponseDtoBuilder get data =>
      _$this._data ??= StrategyPlazaEditSessionResponseDtoBuilder();
  set data(StrategyPlazaEditSessionResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  StrategyPlazaProxyControllerEditSession200ResponseBuilder() {
    StrategyPlazaProxyControllerEditSession200Response._defaults(this);
  }

  StrategyPlazaProxyControllerEditSession200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaProxyControllerEditSession200Response other) {
    _$v = other as _$StrategyPlazaProxyControllerEditSession200Response;
  }

  @override
  void update(
    void Function(StrategyPlazaProxyControllerEditSession200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaProxyControllerEditSession200Response build() => _build();

  _$StrategyPlazaProxyControllerEditSession200Response _build() {
    _$StrategyPlazaProxyControllerEditSession200Response _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaProxyControllerEditSession200Response._(
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
          r'StrategyPlazaProxyControllerEditSession200Response',
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
