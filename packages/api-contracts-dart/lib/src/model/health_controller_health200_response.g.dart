// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'health_controller_health200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$HealthControllerHealth200Response
    extends HealthControllerHealth200Response {
  @override
  final HealthControllerHealth200ResponseData? data;
  @override
  final String? message;

  factory _$HealthControllerHealth200Response([
    void Function(HealthControllerHealth200ResponseBuilder)? updates,
  ]) => (HealthControllerHealth200ResponseBuilder()..update(updates))._build();

  _$HealthControllerHealth200Response._({this.data, this.message}) : super._();
  @override
  HealthControllerHealth200Response rebuild(
    void Function(HealthControllerHealth200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  HealthControllerHealth200ResponseBuilder toBuilder() =>
      HealthControllerHealth200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is HealthControllerHealth200Response &&
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
    return (newBuiltValueToStringHelper(r'HealthControllerHealth200Response')
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class HealthControllerHealth200ResponseBuilder
    implements
        Builder<
          HealthControllerHealth200Response,
          HealthControllerHealth200ResponseBuilder
        > {
  _$HealthControllerHealth200Response? _$v;

  HealthControllerHealth200ResponseDataBuilder? _data;
  HealthControllerHealth200ResponseDataBuilder get data =>
      _$this._data ??= HealthControllerHealth200ResponseDataBuilder();
  set data(HealthControllerHealth200ResponseDataBuilder? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  HealthControllerHealth200ResponseBuilder() {
    HealthControllerHealth200Response._defaults(this);
  }

  HealthControllerHealth200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(HealthControllerHealth200Response other) {
    _$v = other as _$HealthControllerHealth200Response;
  }

  @override
  void update(
    void Function(HealthControllerHealth200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  HealthControllerHealth200Response build() => _build();

  _$HealthControllerHealth200Response _build() {
    _$HealthControllerHealth200Response _$result;
    try {
      _$result =
          _$v ??
          _$HealthControllerHealth200Response._(
            data: _data?.build(),
            message: message,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        _data?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'HealthControllerHealth200Response',
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
