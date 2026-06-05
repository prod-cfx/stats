// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_trades_pair_config_controller_get_all_configs200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminTradesPairConfigControllerGetAllConfigs200Response
    extends AdminTradesPairConfigControllerGetAllConfigs200Response {
  @override
  final BuiltList<TradesPairConfigResponseDto>? data;
  @override
  final String? message;

  factory _$AdminTradesPairConfigControllerGetAllConfigs200Response([
    void Function(
      AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminTradesPairConfigControllerGetAllConfigs200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminTradesPairConfigControllerGetAllConfigs200Response rebuild(
    void Function(
      AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder toBuilder() =>
      AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminTradesPairConfigControllerGetAllConfigs200Response &&
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
            r'AdminTradesPairConfigControllerGetAllConfigs200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder
    implements
        Builder<
          AdminTradesPairConfigControllerGetAllConfigs200Response,
          AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder
        > {
  _$AdminTradesPairConfigControllerGetAllConfigs200Response? _$v;

  ListBuilder<TradesPairConfigResponseDto>? _data;
  ListBuilder<TradesPairConfigResponseDto> get data =>
      _$this._data ??= ListBuilder<TradesPairConfigResponseDto>();
  set data(ListBuilder<TradesPairConfigResponseDto>? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder() {
    AdminTradesPairConfigControllerGetAllConfigs200Response._defaults(this);
  }

  AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminTradesPairConfigControllerGetAllConfigs200Response other) {
    _$v = other as _$AdminTradesPairConfigControllerGetAllConfigs200Response;
  }

  @override
  void update(
    void Function(
      AdminTradesPairConfigControllerGetAllConfigs200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminTradesPairConfigControllerGetAllConfigs200Response build() => _build();

  _$AdminTradesPairConfigControllerGetAllConfigs200Response _build() {
    _$AdminTradesPairConfigControllerGetAllConfigs200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminTradesPairConfigControllerGetAllConfigs200Response._(
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
          r'AdminTradesPairConfigControllerGetAllConfigs200Response',
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
