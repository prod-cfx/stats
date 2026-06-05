// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_interest_controller_upsert201_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OpenInterestControllerUpsert201Response
    extends OpenInterestControllerUpsert201Response {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$OpenInterestControllerUpsert201Response([
    void Function(OpenInterestControllerUpsert201ResponseBuilder)? updates,
  ]) => (OpenInterestControllerUpsert201ResponseBuilder()..update(updates))
      ._build();

  _$OpenInterestControllerUpsert201Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  OpenInterestControllerUpsert201Response rebuild(
    void Function(OpenInterestControllerUpsert201ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OpenInterestControllerUpsert201ResponseBuilder toBuilder() =>
      OpenInterestControllerUpsert201ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OpenInterestControllerUpsert201Response &&
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
            r'OpenInterestControllerUpsert201Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class OpenInterestControllerUpsert201ResponseBuilder
    implements
        Builder<
          OpenInterestControllerUpsert201Response,
          OpenInterestControllerUpsert201ResponseBuilder
        >,
        BaseResponseDtoBuilder {
  _$OpenInterestControllerUpsert201Response? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  OpenInterestControllerUpsert201ResponseBuilder() {
    OpenInterestControllerUpsert201Response._defaults(this);
  }

  OpenInterestControllerUpsert201ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data;
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(covariant OpenInterestControllerUpsert201Response other) {
    _$v = other as _$OpenInterestControllerUpsert201Response;
  }

  @override
  void update(
    void Function(OpenInterestControllerUpsert201ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  OpenInterestControllerUpsert201Response build() => _build();

  _$OpenInterestControllerUpsert201Response _build() {
    final _$result =
        _$v ??
        _$OpenInterestControllerUpsert201Response._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'OpenInterestControllerUpsert201Response',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
