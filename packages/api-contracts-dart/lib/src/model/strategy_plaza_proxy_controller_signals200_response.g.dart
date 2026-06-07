// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'strategy_plaza_proxy_controller_signals200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$StrategyPlazaProxyControllerSignals200Response
    extends StrategyPlazaProxyControllerSignals200Response {
  @override
  final BuiltList<StrategyPlazaSignalResponseDto> data;
  @override
  final String? message;

  factory _$StrategyPlazaProxyControllerSignals200Response([
    void Function(StrategyPlazaProxyControllerSignals200ResponseBuilder)?
    updates,
  ]) =>
      (StrategyPlazaProxyControllerSignals200ResponseBuilder()..update(updates))
          ._build();

  _$StrategyPlazaProxyControllerSignals200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  StrategyPlazaProxyControllerSignals200Response rebuild(
    void Function(StrategyPlazaProxyControllerSignals200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  StrategyPlazaProxyControllerSignals200ResponseBuilder toBuilder() =>
      StrategyPlazaProxyControllerSignals200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is StrategyPlazaProxyControllerSignals200Response &&
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
            r'StrategyPlazaProxyControllerSignals200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class StrategyPlazaProxyControllerSignals200ResponseBuilder
    implements
        Builder<
          StrategyPlazaProxyControllerSignals200Response,
          StrategyPlazaProxyControllerSignals200ResponseBuilder
        > {
  _$StrategyPlazaProxyControllerSignals200Response? _$v;

  ListBuilder<StrategyPlazaSignalResponseDto>? _data;
  ListBuilder<StrategyPlazaSignalResponseDto> get data =>
      _$this._data ??= ListBuilder<StrategyPlazaSignalResponseDto>();
  set data(ListBuilder<StrategyPlazaSignalResponseDto>? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  StrategyPlazaProxyControllerSignals200ResponseBuilder() {
    StrategyPlazaProxyControllerSignals200Response._defaults(this);
  }

  StrategyPlazaProxyControllerSignals200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(StrategyPlazaProxyControllerSignals200Response other) {
    _$v = other as _$StrategyPlazaProxyControllerSignals200Response;
  }

  @override
  void update(
    void Function(StrategyPlazaProxyControllerSignals200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  StrategyPlazaProxyControllerSignals200Response build() => _build();

  _$StrategyPlazaProxyControllerSignals200Response _build() {
    _$StrategyPlazaProxyControllerSignals200Response _$result;
    try {
      _$result =
          _$v ??
          _$StrategyPlazaProxyControllerSignals200Response._(
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
          r'StrategyPlazaProxyControllerSignals200Response',
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
