// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_interest_controller_batch_upsert201_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OpenInterestControllerBatchUpsert201Response
    extends OpenInterestControllerBatchUpsert201Response {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$OpenInterestControllerBatchUpsert201Response([
    void Function(OpenInterestControllerBatchUpsert201ResponseBuilder)? updates,
  ]) => (OpenInterestControllerBatchUpsert201ResponseBuilder()..update(updates))
      ._build();

  _$OpenInterestControllerBatchUpsert201Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  OpenInterestControllerBatchUpsert201Response rebuild(
    void Function(OpenInterestControllerBatchUpsert201ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OpenInterestControllerBatchUpsert201ResponseBuilder toBuilder() =>
      OpenInterestControllerBatchUpsert201ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OpenInterestControllerBatchUpsert201Response &&
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
            r'OpenInterestControllerBatchUpsert201Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class OpenInterestControllerBatchUpsert201ResponseBuilder
    implements
        Builder<
          OpenInterestControllerBatchUpsert201Response,
          OpenInterestControllerBatchUpsert201ResponseBuilder
        >,
        BaseResponseDtoBuilder {
  _$OpenInterestControllerBatchUpsert201Response? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  OpenInterestControllerBatchUpsert201ResponseBuilder() {
    OpenInterestControllerBatchUpsert201Response._defaults(this);
  }

  OpenInterestControllerBatchUpsert201ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data;
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(covariant OpenInterestControllerBatchUpsert201Response other) {
    _$v = other as _$OpenInterestControllerBatchUpsert201Response;
  }

  @override
  void update(
    void Function(OpenInterestControllerBatchUpsert201ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  OpenInterestControllerBatchUpsert201Response build() => _build();

  _$OpenInterestControllerBatchUpsert201Response _build() {
    final _$result =
        _$v ??
        _$OpenInterestControllerBatchUpsert201Response._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'OpenInterestControllerBatchUpsert201Response',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
