// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_orderbook_controller_get_aggregated_orderbook200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response
    extends AggregatedOrderbookControllerGetAggregatedOrderbook200Response {
  @override
  final AggregatedOrderbookResponseDto? data;
  @override
  final String? message;

  factory _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response([
    void Function(
      AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AggregatedOrderbookControllerGetAggregatedOrderbook200Response rebuild(
    void Function(
      AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder
  toBuilder() =>
      AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other
            is AggregatedOrderbookControllerGetAggregatedOrderbook200Response &&
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
            r'AggregatedOrderbookControllerGetAggregatedOrderbook200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder
    implements
        Builder<
          AggregatedOrderbookControllerGetAggregatedOrderbook200Response,
          AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder
        > {
  _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response? _$v;

  AggregatedOrderbookResponseDtoBuilder? _data;
  AggregatedOrderbookResponseDtoBuilder get data =>
      _$this._data ??= AggregatedOrderbookResponseDtoBuilder();
  set data(AggregatedOrderbookResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder() {
    AggregatedOrderbookControllerGetAggregatedOrderbook200Response._defaults(
      this,
    );
  }

  AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder
  get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(
    AggregatedOrderbookControllerGetAggregatedOrderbook200Response other,
  ) {
    _$v =
        other
            as _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response;
  }

  @override
  void update(
    void Function(
      AggregatedOrderbookControllerGetAggregatedOrderbook200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedOrderbookControllerGetAggregatedOrderbook200Response build() =>
      _build();

  _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response _build() {
    _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response _$result;
    try {
      _$result =
          _$v ??
          _$AggregatedOrderbookControllerGetAggregatedOrderbook200Response._(
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
          r'AggregatedOrderbookControllerGetAggregatedOrderbook200Response',
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
