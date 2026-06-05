// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'markets_controller_get_exchange_long_short_ratio200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$MarketsControllerGetExchangeLongShortRatio200Response
    extends MarketsControllerGetExchangeLongShortRatio200Response {
  @override
  final JsonObject data;
  @override
  final String? message;

  factory _$MarketsControllerGetExchangeLongShortRatio200Response([
    void Function(MarketsControllerGetExchangeLongShortRatio200ResponseBuilder)?
    updates,
  ]) =>
      (MarketsControllerGetExchangeLongShortRatio200ResponseBuilder()
            ..update(updates))
          ._build();

  _$MarketsControllerGetExchangeLongShortRatio200Response._({
    required this.data,
    this.message,
  }) : super._();
  @override
  MarketsControllerGetExchangeLongShortRatio200Response rebuild(
    void Function(MarketsControllerGetExchangeLongShortRatio200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  MarketsControllerGetExchangeLongShortRatio200ResponseBuilder toBuilder() =>
      MarketsControllerGetExchangeLongShortRatio200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is MarketsControllerGetExchangeLongShortRatio200Response &&
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
            r'MarketsControllerGetExchangeLongShortRatio200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class MarketsControllerGetExchangeLongShortRatio200ResponseBuilder
    implements
        Builder<
          MarketsControllerGetExchangeLongShortRatio200Response,
          MarketsControllerGetExchangeLongShortRatio200ResponseBuilder
        >,
        BaseResponseDtoBuilder {
  _$MarketsControllerGetExchangeLongShortRatio200Response? _$v;

  JsonObject? _data;
  JsonObject? get data => _$this._data;
  set data(covariant JsonObject? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(covariant String? message) => _$this._message = message;

  MarketsControllerGetExchangeLongShortRatio200ResponseBuilder() {
    MarketsControllerGetExchangeLongShortRatio200Response._defaults(this);
  }

  MarketsControllerGetExchangeLongShortRatio200ResponseBuilder get _$this {
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
    covariant MarketsControllerGetExchangeLongShortRatio200Response other,
  ) {
    _$v = other as _$MarketsControllerGetExchangeLongShortRatio200Response;
  }

  @override
  void update(
    void Function(MarketsControllerGetExchangeLongShortRatio200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  MarketsControllerGetExchangeLongShortRatio200Response build() => _build();

  _$MarketsControllerGetExchangeLongShortRatio200Response _build() {
    final _$result =
        _$v ??
        _$MarketsControllerGetExchangeLongShortRatio200Response._(
          data: BuiltValueNullFieldError.checkNotNull(
            data,
            r'MarketsControllerGetExchangeLongShortRatio200Response',
            'data',
          ),
          message: message,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
