// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_exchange_config_controller_create_config200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminExchangeConfigControllerCreateConfig200Response
    extends AdminExchangeConfigControllerCreateConfig200Response {
  @override
  final ExchangeConfigResponseDto? data;
  @override
  final String? message;

  factory _$AdminExchangeConfigControllerCreateConfig200Response([
    void Function(AdminExchangeConfigControllerCreateConfig200ResponseBuilder)?
    updates,
  ]) =>
      (AdminExchangeConfigControllerCreateConfig200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminExchangeConfigControllerCreateConfig200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminExchangeConfigControllerCreateConfig200Response rebuild(
    void Function(AdminExchangeConfigControllerCreateConfig200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminExchangeConfigControllerCreateConfig200ResponseBuilder toBuilder() =>
      AdminExchangeConfigControllerCreateConfig200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminExchangeConfigControllerCreateConfig200Response &&
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
            r'AdminExchangeConfigControllerCreateConfig200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminExchangeConfigControllerCreateConfig200ResponseBuilder
    implements
        Builder<
          AdminExchangeConfigControllerCreateConfig200Response,
          AdminExchangeConfigControllerCreateConfig200ResponseBuilder
        > {
  _$AdminExchangeConfigControllerCreateConfig200Response? _$v;

  ExchangeConfigResponseDtoBuilder? _data;
  ExchangeConfigResponseDtoBuilder get data =>
      _$this._data ??= ExchangeConfigResponseDtoBuilder();
  set data(ExchangeConfigResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminExchangeConfigControllerCreateConfig200ResponseBuilder() {
    AdminExchangeConfigControllerCreateConfig200Response._defaults(this);
  }

  AdminExchangeConfigControllerCreateConfig200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminExchangeConfigControllerCreateConfig200Response other) {
    _$v = other as _$AdminExchangeConfigControllerCreateConfig200Response;
  }

  @override
  void update(
    void Function(AdminExchangeConfigControllerCreateConfig200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminExchangeConfigControllerCreateConfig200Response build() => _build();

  _$AdminExchangeConfigControllerCreateConfig200Response _build() {
    _$AdminExchangeConfigControllerCreateConfig200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminExchangeConfigControllerCreateConfig200Response._(
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
          r'AdminExchangeConfigControllerCreateConfig200Response',
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
