// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'crypto_stock_quotes_controller_get_latest200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CryptoStockQuotesControllerGetLatest200Response
    extends CryptoStockQuotesControllerGetLatest200Response {
  @override
  final BuiltList<CryptoStockQuoteResponseDto>? data;
  @override
  final String? message;

  factory _$CryptoStockQuotesControllerGetLatest200Response([
    void Function(CryptoStockQuotesControllerGetLatest200ResponseBuilder)?
    updates,
  ]) =>
      (CryptoStockQuotesControllerGetLatest200ResponseBuilder()
            ..update(updates))
          ._build();

  _$CryptoStockQuotesControllerGetLatest200Response._({this.data, this.message})
    : super._();
  @override
  CryptoStockQuotesControllerGetLatest200Response rebuild(
    void Function(CryptoStockQuotesControllerGetLatest200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CryptoStockQuotesControllerGetLatest200ResponseBuilder toBuilder() =>
      CryptoStockQuotesControllerGetLatest200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CryptoStockQuotesControllerGetLatest200Response &&
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
            r'CryptoStockQuotesControllerGetLatest200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class CryptoStockQuotesControllerGetLatest200ResponseBuilder
    implements
        Builder<
          CryptoStockQuotesControllerGetLatest200Response,
          CryptoStockQuotesControllerGetLatest200ResponseBuilder
        > {
  _$CryptoStockQuotesControllerGetLatest200Response? _$v;

  ListBuilder<CryptoStockQuoteResponseDto>? _data;
  ListBuilder<CryptoStockQuoteResponseDto> get data =>
      _$this._data ??= ListBuilder<CryptoStockQuoteResponseDto>();
  set data(ListBuilder<CryptoStockQuoteResponseDto>? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  CryptoStockQuotesControllerGetLatest200ResponseBuilder() {
    CryptoStockQuotesControllerGetLatest200Response._defaults(this);
  }

  CryptoStockQuotesControllerGetLatest200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CryptoStockQuotesControllerGetLatest200Response other) {
    _$v = other as _$CryptoStockQuotesControllerGetLatest200Response;
  }

  @override
  void update(
    void Function(CryptoStockQuotesControllerGetLatest200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  CryptoStockQuotesControllerGetLatest200Response build() => _build();

  _$CryptoStockQuotesControllerGetLatest200Response _build() {
    _$CryptoStockQuotesControllerGetLatest200Response _$result;
    try {
      _$result =
          _$v ??
          _$CryptoStockQuotesControllerGetLatest200Response._(
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
          r'CryptoStockQuotesControllerGetLatest200Response',
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
