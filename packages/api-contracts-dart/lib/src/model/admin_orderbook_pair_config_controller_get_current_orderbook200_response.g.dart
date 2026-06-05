// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_orderbook_pair_config_controller_get_current_orderbook200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response
    extends AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response {
  @override
  final VenueOrderBookDto? data;
  @override
  final String? message;

  factory _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response([
    void Function(
      AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder,
    )?
    updates,
  ]) =>
      (AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response rebuild(
    void Function(
      AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder
  toBuilder() =>
      AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other
            is AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response &&
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
            r'AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder
    implements
        Builder<
          AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response,
          AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder
        > {
  _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response? _$v;

  VenueOrderBookDtoBuilder? _data;
  VenueOrderBookDtoBuilder get data =>
      _$this._data ??= VenueOrderBookDtoBuilder();
  set data(VenueOrderBookDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder() {
    AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response._defaults(
      this,
    );
  }

  AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder
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
    AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response other,
  ) {
    _$v =
        other
            as _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response;
  }

  @override
  void update(
    void Function(
      AdminOrderbookPairConfigControllerGetCurrentOrderbook200ResponseBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response build() =>
      _build();

  _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response _build() {
    _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response._(
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
          r'AdminOrderbookPairConfigControllerGetCurrentOrderbook200Response',
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
