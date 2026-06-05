// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_proxy_controller_run200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaProxyControllerRun200Response
    extends StrategyPlazaProxyControllerRun200Response {
  @override
  final StrategyPlazaProxyControllerRun200ResponseData data;
  @override
  final String? message;

  factory _$StrategyPlazaProxyControllerRun200Response([
    void Function(StrategyPlazaProxyControllerRun200ResponseBuilder)? updates,
  ]) => (StrategyPlazaProxyControllerRun200ResponseBuilder()..update(updates))
      ._build();

  _$StrategyPlazaProxyControllerRun200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  StrategyPlazaProxyControllerRun200Response rebuild(
    void Function(StrategyPlazaProxyControllerRun200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaProxyControllerRun200ResponseBuilder toBuilder() =>
      StrategyPlazaProxyControllerRun200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaProxyControllerRun200Response &&
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
            r'StrategyPlazaProxyControllerRun200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class StrategyPlazaProxyControllerRun200ResponseBuilder
    implements
        Builder<
          StrategyPlazaProxyControllerRun200Response,
          StrategyPlazaProxyControllerRun200ResponseBuilder
        > {
  _$StrategyPlazaProxyControllerRun200Response? _$v;

  StrategyPlazaProxyControllerRun200ResponseDataBuilder? _data;
  StrategyPlazaProxyControllerRun200ResponseDataBuilder get data =>
      _$this._data ??= StrategyPlazaProxyControllerRun200ResponseDataBuilder();
  set data(StrategyPlazaProxyControllerRun200ResponseDataBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  StrategyPlazaProxyControllerRun200ResponseBuilder() {
    StrategyPlazaProxyControllerRun200Response._defaults(this);
  }

  StrategyPlazaProxyControllerRun200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaProxyControllerRun200Response other) {
    _$v = other as _$StrategyPlazaProxyControllerRun200Response;
  }

  @override
  void update(
    void Function(StrategyPlazaProxyControllerRun200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaProxyControllerRun200Response build() => _build();

  _$StrategyPlazaProxyControllerRun200Response _build() {
    _$StrategyPlazaProxyControllerRun200Response _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaProxyControllerRun200Response._(
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
          r'StrategyPlazaProxyControllerRun200Response',
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
