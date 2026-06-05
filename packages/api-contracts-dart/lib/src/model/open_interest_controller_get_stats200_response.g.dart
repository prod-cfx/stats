// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_interest_controller_get_stats200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OpenInterestControllerGetStats200Response
    extends OpenInterestControllerGetStats200Response {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$OpenInterestControllerGetStats200Response([
    void Function(OpenInterestControllerGetStats200ResponseBuilder)? updates,
  ]) => (OpenInterestControllerGetStats200ResponseBuilder()..update(updates))
      ._build();

  _$OpenInterestControllerGetStats200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  OpenInterestControllerGetStats200Response rebuild(
    void Function(OpenInterestControllerGetStats200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OpenInterestControllerGetStats200ResponseBuilder toBuilder() =>
      OpenInterestControllerGetStats200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OpenInterestControllerGetStats200Response &&
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
            r'OpenInterestControllerGetStats200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class OpenInterestControllerGetStats200ResponseBuilder
    implements
        Builder<
          OpenInterestControllerGetStats200Response,
          OpenInterestControllerGetStats200ResponseBuilder
        >,
        BaseResponseDtoBuilder {
  _$OpenInterestControllerGetStats200Response? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  OpenInterestControllerGetStats200ResponseBuilder() {
    OpenInterestControllerGetStats200Response._defaults(this);
  }

  OpenInterestControllerGetStats200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data;
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(covariant OpenInterestControllerGetStats200Response other) {
    _$v = other as _$OpenInterestControllerGetStats200Response;
  }

  @override
  void update(
    void Function(OpenInterestControllerGetStats200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  OpenInterestControllerGetStats200Response build() => _build();

  _$OpenInterestControllerGetStats200Response _build() {
    final _$result =
        _$v ??
        _$OpenInterestControllerGetStats200Response._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'OpenInterestControllerGetStats200Response',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
