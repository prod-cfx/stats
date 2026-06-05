// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_orderbook_controller_get_available_markets200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedOrderbookControllerGetAvailableMarkets200Response
    extends AggregatedOrderbookControllerGetAvailableMarkets200Response {
  @override
  final BuiltList<AggregatedOrderbookMarketResponseDto>? data;
  @override
  final String? message;

  factory _$AggregatedOrderbookControllerGetAvailableMarkets200Response([
    void Function(
      AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AggregatedOrderbookControllerGetAvailableMarkets200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AggregatedOrderbookControllerGetAvailableMarkets200Response rebuild(
    void Function(
      AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder
  toBuilder() =>
      AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other
            is AggregatedOrderbookControllerGetAvailableMarkets200Response &&
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
            r'AggregatedOrderbookControllerGetAvailableMarkets200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder
    implements
        Builder<
          AggregatedOrderbookControllerGetAvailableMarkets200Response,
          AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder
        > {
  _$AggregatedOrderbookControllerGetAvailableMarkets200Response? _$v;

  ListBuilder<AggregatedOrderbookMarketResponseDto>? _data;
  ListBuilder<AggregatedOrderbookMarketResponseDto> get data =>
      _$this._data ??= ListBuilder<AggregatedOrderbookMarketResponseDto>();
  set data(ListBuilder<AggregatedOrderbookMarketResponseDto>? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder() {
    AggregatedOrderbookControllerGetAvailableMarkets200Response._defaults(this);
  }

  AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder
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
    AggregatedOrderbookControllerGetAvailableMarkets200Response other,
  ) {
    _$v =
        other as _$AggregatedOrderbookControllerGetAvailableMarkets200Response;
  }

  @override
  void update(
    void Function(
      AggregatedOrderbookControllerGetAvailableMarkets200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedOrderbookControllerGetAvailableMarkets200Response build() =>
      _build();

  _$AggregatedOrderbookControllerGetAvailableMarkets200Response _build() {
    _$AggregatedOrderbookControllerGetAvailableMarkets200Response _$result;
    try {
      _$result =
          _$v ??
          _$AggregatedOrderbookControllerGetAvailableMarkets200Response._(
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
          r'AggregatedOrderbookControllerGetAvailableMarkets200Response',
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
