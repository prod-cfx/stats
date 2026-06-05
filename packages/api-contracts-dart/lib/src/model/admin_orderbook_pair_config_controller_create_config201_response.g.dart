// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_orderbook_pair_config_controller_create_config201_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminOrderbookPairConfigControllerCreateConfig201Response
    extends AdminOrderbookPairConfigControllerCreateConfig201Response {
  @override
  final OrderbookPairConfigResponseDto? data;
  @override
  final String? message;

  factory _$AdminOrderbookPairConfigControllerCreateConfig201Response([
    void Function(
      AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder,
    )?
    updates,
  ]) =>
      (AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminOrderbookPairConfigControllerCreateConfig201Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminOrderbookPairConfigControllerCreateConfig201Response rebuild(
    void Function(
      AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder
  toBuilder() =>
      AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminOrderbookPairConfigControllerCreateConfig201Response &&
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
            r'AdminOrderbookPairConfigControllerCreateConfig201Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder
    implements
        Builder<
          AdminOrderbookPairConfigControllerCreateConfig201Response,
          AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder
        > {
  _$AdminOrderbookPairConfigControllerCreateConfig201Response? _$v;

  OrderbookPairConfigResponseDtoBuilder? _data;
  OrderbookPairConfigResponseDtoBuilder get data =>
      _$this._data ??= OrderbookPairConfigResponseDtoBuilder();
  set data(OrderbookPairConfigResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder() {
    AdminOrderbookPairConfigControllerCreateConfig201Response._defaults(this);
  }

  AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder get _$this {
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
    AdminOrderbookPairConfigControllerCreateConfig201Response other,
  ) {
    _$v = other as _$AdminOrderbookPairConfigControllerCreateConfig201Response;
  }

  @override
  void update(
    void Function(
      AdminOrderbookPairConfigControllerCreateConfig201ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminOrderbookPairConfigControllerCreateConfig201Response build() => _build();

  _$AdminOrderbookPairConfigControllerCreateConfig201Response _build() {
    _$AdminOrderbookPairConfigControllerCreateConfig201Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminOrderbookPairConfigControllerCreateConfig201Response._(
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
          r'AdminOrderbookPairConfigControllerCreateConfig201Response',
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
