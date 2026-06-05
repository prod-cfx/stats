// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_liquidation_controller_get_summary200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedLiquidationControllerGetSummary200Response
    extends AggregatedLiquidationControllerGetSummary200Response {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$AggregatedLiquidationControllerGetSummary200Response([
    void Function(AggregatedLiquidationControllerGetSummary200ResponseBuilder)?
    updates,
  ]) =>
      (AggregatedLiquidationControllerGetSummary200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AggregatedLiquidationControllerGetSummary200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  AggregatedLiquidationControllerGetSummary200Response rebuild(
    void Function(AggregatedLiquidationControllerGetSummary200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedLiquidationControllerGetSummary200ResponseBuilder toBuilder() =>
      AggregatedLiquidationControllerGetSummary200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedLiquidationControllerGetSummary200Response &&
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
            r'AggregatedLiquidationControllerGetSummary200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AggregatedLiquidationControllerGetSummary200ResponseBuilder
    implements
        Builder<
          AggregatedLiquidationControllerGetSummary200Response,
          AggregatedLiquidationControllerGetSummary200ResponseBuilder
        >,
        BaseResponseDtoBuilder {
  _$AggregatedLiquidationControllerGetSummary200Response? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  AggregatedLiquidationControllerGetSummary200ResponseBuilder() {
    AggregatedLiquidationControllerGetSummary200Response._defaults(this);
  }

  AggregatedLiquidationControllerGetSummary200ResponseBuilder get _$this {
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
    covariant AggregatedLiquidationControllerGetSummary200Response other,
  ) {
    _$v = other as _$AggregatedLiquidationControllerGetSummary200Response;
  }

  @override
  void update(
    void Function(AggregatedLiquidationControllerGetSummary200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedLiquidationControllerGetSummary200Response build() => _build();

  _$AggregatedLiquidationControllerGetSummary200Response _build() {
    final _$result =
        _$v ??
        _$AggregatedLiquidationControllerGetSummary200Response._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'AggregatedLiquidationControllerGetSummary200Response',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
