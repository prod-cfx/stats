// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_proxy_controller_detail200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaProxyControllerDetail200Response
    extends StrategyPlazaProxyControllerDetail200Response {
  @override
  final StrategyPlazaTemplateResponseDto data;
  @override
  final String? message;

  factory _$StrategyPlazaProxyControllerDetail200Response([
    void Function(StrategyPlazaProxyControllerDetail200ResponseBuilder)?
    updates,
  ]) =>
      (StrategyPlazaProxyControllerDetail200ResponseBuilder()..update(updates))
          ._build();

  _$StrategyPlazaProxyControllerDetail200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  StrategyPlazaProxyControllerDetail200Response rebuild(
    void Function(StrategyPlazaProxyControllerDetail200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaProxyControllerDetail200ResponseBuilder toBuilder() =>
      StrategyPlazaProxyControllerDetail200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaProxyControllerDetail200Response &&
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
            r'StrategyPlazaProxyControllerDetail200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class StrategyPlazaProxyControllerDetail200ResponseBuilder
    implements
        Builder<
          StrategyPlazaProxyControllerDetail200Response,
          StrategyPlazaProxyControllerDetail200ResponseBuilder
        > {
  _$StrategyPlazaProxyControllerDetail200Response? _$v;

  StrategyPlazaTemplateResponseDtoBuilder? _data;
  StrategyPlazaTemplateResponseDtoBuilder get data =>
      _$this._data ??= StrategyPlazaTemplateResponseDtoBuilder();
  set data(StrategyPlazaTemplateResponseDtoBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  StrategyPlazaProxyControllerDetail200ResponseBuilder() {
    StrategyPlazaProxyControllerDetail200Response._defaults(this);
  }

  StrategyPlazaProxyControllerDetail200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaProxyControllerDetail200Response other) {
    _$v = other as _$StrategyPlazaProxyControllerDetail200Response;
  }

  @override
  void update(
    void Function(StrategyPlazaProxyControllerDetail200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaProxyControllerDetail200Response build() => _build();

  _$StrategyPlazaProxyControllerDetail200Response _build() {
    _$StrategyPlazaProxyControllerDetail200Response _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaProxyControllerDetail200Response._(
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
          r'StrategyPlazaProxyControllerDetail200Response',
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
