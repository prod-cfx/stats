// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'backtesting_proxy_controller_get_job200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BacktestingProxyControllerGetJob200Response
    extends BacktestingProxyControllerGetJob200Response {
  @override
  final BacktestingJobResponseDto data;
  @override
  final String? message;

  factory _$BacktestingProxyControllerGetJob200Response([
    void Function(BacktestingProxyControllerGetJob200ResponseBuilder)? updates,
  ]) => (BacktestingProxyControllerGetJob200ResponseBuilder()..update(updates))
      ._build();

  _$BacktestingProxyControllerGetJob200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  BacktestingProxyControllerGetJob200Response rebuild(
    void Function(BacktestingProxyControllerGetJob200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BacktestingProxyControllerGetJob200ResponseBuilder toBuilder() =>
      BacktestingProxyControllerGetJob200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BacktestingProxyControllerGetJob200Response &&
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
            r'BacktestingProxyControllerGetJob200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class BacktestingProxyControllerGetJob200ResponseBuilder
    implements
        Builder<
          BacktestingProxyControllerGetJob200Response,
          BacktestingProxyControllerGetJob200ResponseBuilder
        > {
  _$BacktestingProxyControllerGetJob200Response? _$v;

  BacktestingJobResponseDtoBuilder? _data;
  BacktestingJobResponseDtoBuilder get data =>
      _$this._data ??= BacktestingJobResponseDtoBuilder();
  set data(BacktestingJobResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  BacktestingProxyControllerGetJob200ResponseBuilder() {
    BacktestingProxyControllerGetJob200Response._defaults(this);
  }

  BacktestingProxyControllerGetJob200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BacktestingProxyControllerGetJob200Response other) {
    _$v = other as _$BacktestingProxyControllerGetJob200Response;
  }

  @override
  void update(
    void Function(BacktestingProxyControllerGetJob200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  BacktestingProxyControllerGetJob200Response build() => _build();

  _$BacktestingProxyControllerGetJob200Response _build() {
    _$BacktestingProxyControllerGetJob200Response _$result;
    try {
      _$result =
          _$v ??
          _$BacktestingProxyControllerGetJob200Response._(
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
          r'BacktestingProxyControllerGetJob200Response',
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
