// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_interest_controller_get_aggregate_snapshot200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OpenInterestControllerGetAggregateSnapshot200Response
    extends OpenInterestControllerGetAggregateSnapshot200Response {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$OpenInterestControllerGetAggregateSnapshot200Response([
    void Function(OpenInterestControllerGetAggregateSnapshot200ResponseBuilder)?
    updates,
  ]) =>
      (OpenInterestControllerGetAggregateSnapshot200ResponseBuilder()
            ..update(updates))
          ._build();

  _$OpenInterestControllerGetAggregateSnapshot200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  OpenInterestControllerGetAggregateSnapshot200Response rebuild(
    void Function(OpenInterestControllerGetAggregateSnapshot200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OpenInterestControllerGetAggregateSnapshot200ResponseBuilder toBuilder() =>
      OpenInterestControllerGetAggregateSnapshot200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OpenInterestControllerGetAggregateSnapshot200Response &&
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
            r'OpenInterestControllerGetAggregateSnapshot200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class OpenInterestControllerGetAggregateSnapshot200ResponseBuilder
    implements
        Builder<
          OpenInterestControllerGetAggregateSnapshot200Response,
          OpenInterestControllerGetAggregateSnapshot200ResponseBuilder
        >,
        BaseResponseDtoBuilder {
  _$OpenInterestControllerGetAggregateSnapshot200Response? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  OpenInterestControllerGetAggregateSnapshot200ResponseBuilder() {
    OpenInterestControllerGetAggregateSnapshot200Response._defaults(this);
  }

  OpenInterestControllerGetAggregateSnapshot200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data;
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(
    covariant OpenInterestControllerGetAggregateSnapshot200Response other,
  ) {
    _$v = other as _$OpenInterestControllerGetAggregateSnapshot200Response;
  }

  @override
  void update(
    void Function(OpenInterestControllerGetAggregateSnapshot200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  OpenInterestControllerGetAggregateSnapshot200Response build() => _build();

  _$OpenInterestControllerGetAggregateSnapshot200Response _build() {
    final _$result =
        _$v ??
        _$OpenInterestControllerGetAggregateSnapshot200Response._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'OpenInterestControllerGetAggregateSnapshot200Response',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
