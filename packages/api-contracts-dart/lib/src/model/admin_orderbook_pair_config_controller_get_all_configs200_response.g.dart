// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_orderbook_pair_config_controller_get_all_configs200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminOrderbookPairConfigControllerGetAllConfigs200Response
    extends AdminOrderbookPairConfigControllerGetAllConfigs200Response {
  @override
  final BuiltList<OrderbookPairConfigResponseDto>? data;
  @override
  final String? message;

  factory _$AdminOrderbookPairConfigControllerGetAllConfigs200Response([
    void Function(
      AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminOrderbookPairConfigControllerGetAllConfigs200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminOrderbookPairConfigControllerGetAllConfigs200Response rebuild(
    void Function(
      AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder
  toBuilder() =>
      AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other
            is AdminOrderbookPairConfigControllerGetAllConfigs200Response &&
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
            r'AdminOrderbookPairConfigControllerGetAllConfigs200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder
    implements
        Builder<
          AdminOrderbookPairConfigControllerGetAllConfigs200Response,
          AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder
        > {
  _$AdminOrderbookPairConfigControllerGetAllConfigs200Response? _$v;

  ListBuilder<OrderbookPairConfigResponseDto>? _data;
  ListBuilder<OrderbookPairConfigResponseDto> get data =>
      _$this._data ??= ListBuilder<OrderbookPairConfigResponseDto>();
  set data(ListBuilder<OrderbookPairConfigResponseDto>? data) =>
      _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder() {
    AdminOrderbookPairConfigControllerGetAllConfigs200Response._defaults(this);
  }

  AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder get _$this {
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
    AdminOrderbookPairConfigControllerGetAllConfigs200Response other,
  ) {
    _$v = other as _$AdminOrderbookPairConfigControllerGetAllConfigs200Response;
  }

  @override
  void update(
    void Function(
      AdminOrderbookPairConfigControllerGetAllConfigs200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminOrderbookPairConfigControllerGetAllConfigs200Response build() =>
      _build();

  _$AdminOrderbookPairConfigControllerGetAllConfigs200Response _build() {
    _$AdminOrderbookPairConfigControllerGetAllConfigs200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminOrderbookPairConfigControllerGetAllConfigs200Response._(
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
          r'AdminOrderbookPairConfigControllerGetAllConfigs200Response',
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
