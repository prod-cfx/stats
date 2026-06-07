// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_proxy_controller_equity_curve200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaProxyControllerEquityCurve200Response
    extends StrategyPlazaProxyControllerEquityCurve200Response {
  @override
  final BuiltList<num> data;
  @override
  final String? message;

  factory _$StrategyPlazaProxyControllerEquityCurve200Response([
    void Function(StrategyPlazaProxyControllerEquityCurve200ResponseBuilder)?
    updates,
  ]) =>
      (StrategyPlazaProxyControllerEquityCurve200ResponseBuilder()
            ..update(updates))
          ._build();

  _$StrategyPlazaProxyControllerEquityCurve200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  StrategyPlazaProxyControllerEquityCurve200Response rebuild(
    void Function(StrategyPlazaProxyControllerEquityCurve200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaProxyControllerEquityCurve200ResponseBuilder toBuilder() =>
      StrategyPlazaProxyControllerEquityCurve200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaProxyControllerEquityCurve200Response &&
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
            r'StrategyPlazaProxyControllerEquityCurve200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class StrategyPlazaProxyControllerEquityCurve200ResponseBuilder
    implements
        Builder<
          StrategyPlazaProxyControllerEquityCurve200Response,
          StrategyPlazaProxyControllerEquityCurve200ResponseBuilder
        > {
  _$StrategyPlazaProxyControllerEquityCurve200Response? _$v;

  ListBuilder<num>? _data;
  ListBuilder<num> get data => _$this._data ??= ListBuilder<num>();
  set data(ListBuilder<num>? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  StrategyPlazaProxyControllerEquityCurve200ResponseBuilder() {
    StrategyPlazaProxyControllerEquityCurve200Response._defaults(this);
  }

  StrategyPlazaProxyControllerEquityCurve200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaProxyControllerEquityCurve200Response other) {
    _$v = other as _$StrategyPlazaProxyControllerEquityCurve200Response;
  }

  @override
  void update(
    void Function(StrategyPlazaProxyControllerEquityCurve200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaProxyControllerEquityCurve200Response build() => _build();

  _$StrategyPlazaProxyControllerEquityCurve200Response _build() {
    _$StrategyPlazaProxyControllerEquityCurve200Response _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaProxyControllerEquityCurve200Response._(
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
          r'StrategyPlazaProxyControllerEquityCurve200Response',
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
