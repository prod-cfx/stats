// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_proxy_controller_get_job_result200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingProxyControllerGetJobResult200Response
    extends BacktestingProxyControllerGetJobResult200Response {
  @override
  final BacktestingReportResponseDto data;
  @override
  final String? message;

  factory _$BacktestingProxyControllerGetJobResult200Response([
    void Function(BacktestingProxyControllerGetJobResult200ResponseBuilder)?
    updates,
  ]) =>
      (BacktestingProxyControllerGetJobResult200ResponseBuilder()
            ..update(updates))
          ._build();

  _$BacktestingProxyControllerGetJobResult200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  BacktestingProxyControllerGetJobResult200Response rebuild(
    void Function(BacktestingProxyControllerGetJobResult200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingProxyControllerGetJobResult200ResponseBuilder toBuilder() =>
      BacktestingProxyControllerGetJobResult200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingProxyControllerGetJobResult200Response &&
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
            r'BacktestingProxyControllerGetJobResult200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class BacktestingProxyControllerGetJobResult200ResponseBuilder
    implements
        Builder<
          BacktestingProxyControllerGetJobResult200Response,
          BacktestingProxyControllerGetJobResult200ResponseBuilder
        > {
  _$BacktestingProxyControllerGetJobResult200Response? _$v;

  BacktestingReportResponseDtoBuilder? _data;
  BacktestingReportResponseDtoBuilder get data =>
      _$this._data ??= BacktestingReportResponseDtoBuilder();
  set data(BacktestingReportResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  BacktestingProxyControllerGetJobResult200ResponseBuilder() {
    BacktestingProxyControllerGetJobResult200Response._defaults(this);
  }

  BacktestingProxyControllerGetJobResult200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingProxyControllerGetJobResult200Response other) {
    _$v = other as _$BacktestingProxyControllerGetJobResult200Response;
  }

  @override
  void update(
    void Function(BacktestingProxyControllerGetJobResult200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingProxyControllerGetJobResult200Response build() => _build();

  _$BacktestingProxyControllerGetJobResult200Response _build() {
    _$BacktestingProxyControllerGetJobResult200Response _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingProxyControllerGetJobResult200Response._(
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
          r'BacktestingProxyControllerGetJobResult200Response',
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
