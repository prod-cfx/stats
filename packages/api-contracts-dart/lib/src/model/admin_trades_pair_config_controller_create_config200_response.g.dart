// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_trades_pair_config_controller_create_config200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminTradesPairConfigControllerCreateConfig200Response
    extends AdminTradesPairConfigControllerCreateConfig200Response {
  @override
  final TradesPairConfigResponseDto? data;
  @override
  final String? message;

  factory _$AdminTradesPairConfigControllerCreateConfig200Response([
    void Function(
      AdminTradesPairConfigControllerCreateConfig200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AdminTradesPairConfigControllerCreateConfig200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminTradesPairConfigControllerCreateConfig200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminTradesPairConfigControllerCreateConfig200Response rebuild(
    void Function(AdminTradesPairConfigControllerCreateConfig200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminTradesPairConfigControllerCreateConfig200ResponseBuilder toBuilder() =>
      AdminTradesPairConfigControllerCreateConfig200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminTradesPairConfigControllerCreateConfig200Response &&
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
            r'AdminTradesPairConfigControllerCreateConfig200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminTradesPairConfigControllerCreateConfig200ResponseBuilder
    implements
        Builder<
          AdminTradesPairConfigControllerCreateConfig200Response,
          AdminTradesPairConfigControllerCreateConfig200ResponseBuilder
        > {
  _$AdminTradesPairConfigControllerCreateConfig200Response? _$v;

  TradesPairConfigResponseDtoBuilder? _data;
  TradesPairConfigResponseDtoBuilder get data =>
      _$this._data ??= TradesPairConfigResponseDtoBuilder();
  set data(TradesPairConfigResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminTradesPairConfigControllerCreateConfig200ResponseBuilder() {
    AdminTradesPairConfigControllerCreateConfig200Response._defaults(this);
  }

  AdminTradesPairConfigControllerCreateConfig200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminTradesPairConfigControllerCreateConfig200Response other) {
    _$v = other as _$AdminTradesPairConfigControllerCreateConfig200Response;
  }

  @override
  void update(
    void Function(
      AdminTradesPairConfigControllerCreateConfig200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminTradesPairConfigControllerCreateConfig200Response build() => _build();

  _$AdminTradesPairConfigControllerCreateConfig200Response _build() {
    _$AdminTradesPairConfigControllerCreateConfig200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminTradesPairConfigControllerCreateConfig200Response._(
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
          r'AdminTradesPairConfigControllerCreateConfig200Response',
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
