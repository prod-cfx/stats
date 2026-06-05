// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_proxy_controller_list200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaProxyControllerList200Response
    extends StrategyPlazaProxyControllerList200Response {
  @override
  final BuiltList<StrategyPlazaTemplateResponseDto> data;
  @override
  final String? message;

  factory _$StrategyPlazaProxyControllerList200Response([
    void Function(StrategyPlazaProxyControllerList200ResponseBuilder)? updates,
  ]) => (StrategyPlazaProxyControllerList200ResponseBuilder()..update(updates))
      ._build();

  _$StrategyPlazaProxyControllerList200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  StrategyPlazaProxyControllerList200Response rebuild(
    void Function(StrategyPlazaProxyControllerList200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaProxyControllerList200ResponseBuilder toBuilder() =>
      StrategyPlazaProxyControllerList200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaProxyControllerList200Response &&
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
            r'StrategyPlazaProxyControllerList200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class StrategyPlazaProxyControllerList200ResponseBuilder
    implements
        Builder<
          StrategyPlazaProxyControllerList200Response,
          StrategyPlazaProxyControllerList200ResponseBuilder
        > {
  _$StrategyPlazaProxyControllerList200Response? _$v;

  ListBuilder<StrategyPlazaTemplateResponseDto>? _data;
  ListBuilder<StrategyPlazaTemplateResponseDto> get data =>
      _$this._data ??= ListBuilder<StrategyPlazaTemplateResponseDto>();
  set data(ListBuilder<StrategyPlazaTemplateResponseDto>? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  StrategyPlazaProxyControllerList200ResponseBuilder() {
    StrategyPlazaProxyControllerList200Response._defaults(this);
  }

  StrategyPlazaProxyControllerList200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaProxyControllerList200Response other) {
    _$v = other as _$StrategyPlazaProxyControllerList200Response;
  }

  @override
  void update(
    void Function(StrategyPlazaProxyControllerList200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaProxyControllerList200Response build() => _build();

  _$StrategyPlazaProxyControllerList200Response _build() {
    _$StrategyPlazaProxyControllerList200Response _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaProxyControllerList200Response._(
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
          r'StrategyPlazaProxyControllerList200Response',
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
