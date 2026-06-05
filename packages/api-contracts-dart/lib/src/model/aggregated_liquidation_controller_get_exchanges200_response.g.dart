// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_liquidation_controller_get_exchanges200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedLiquidationControllerGetExchanges200Response
    extends AggregatedLiquidationControllerGetExchanges200Response {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$AggregatedLiquidationControllerGetExchanges200Response([
    void Function(
      AggregatedLiquidationControllerGetExchanges200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AggregatedLiquidationControllerGetExchanges200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AggregatedLiquidationControllerGetExchanges200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AggregatedLiquidationControllerGetExchanges200Response rebuild(
    void Function(AggregatedLiquidationControllerGetExchanges200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedLiquidationControllerGetExchanges200ResponseBuilder toBuilder() =>
      AggregatedLiquidationControllerGetExchanges200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedLiquidationControllerGetExchanges200Response &&
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
            r'AggregatedLiquidationControllerGetExchanges200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AggregatedLiquidationControllerGetExchanges200ResponseBuilder
    implements
        Builder<
          AggregatedLiquidationControllerGetExchanges200Response,
          AggregatedLiquidationControllerGetExchanges200ResponseBuilder
        >,
        BaseResponseDtoBuilder {
  _$AggregatedLiquidationControllerGetExchanges200Response? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  AggregatedLiquidationControllerGetExchanges200ResponseBuilder() {
    AggregatedLiquidationControllerGetExchanges200Response._defaults(this);
  }

  AggregatedLiquidationControllerGetExchanges200ResponseBuilder get _$this {
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
    covariant AggregatedLiquidationControllerGetExchanges200Response other,
  ) {
    _$v = other as _$AggregatedLiquidationControllerGetExchanges200Response;
  }

  @override
  void update(
    void Function(
      AggregatedLiquidationControllerGetExchanges200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedLiquidationControllerGetExchanges200Response build() => _build();

  _$AggregatedLiquidationControllerGetExchanges200Response _build() {
    final _$result =
        _$v ??
        _$AggregatedLiquidationControllerGetExchanges200Response._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'AggregatedLiquidationControllerGetExchanges200Response',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
