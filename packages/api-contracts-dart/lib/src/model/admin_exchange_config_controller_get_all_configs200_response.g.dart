// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_exchange_config_controller_get_all_configs200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminExchangeConfigControllerGetAllConfigs200Response
    extends AdminExchangeConfigControllerGetAllConfigs200Response {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$AdminExchangeConfigControllerGetAllConfigs200Response([
    void Function(AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder)?
    updates,
  ]) =>
      (AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminExchangeConfigControllerGetAllConfigs200Response._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  AdminExchangeConfigControllerGetAllConfigs200Response rebuild(
    void Function(AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder toBuilder() =>
      AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminExchangeConfigControllerGetAllConfigs200Response &&
        total == other.total &&
        page == other.page &&
        limit == other.limit &&
        items == other.items;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, total.hashCode);
    _$hash = $jc(_$hash, page.hashCode);
    _$hash = $jc(_$hash, limit.hashCode);
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AdminExchangeConfigControllerGetAllConfigs200Response',
          )
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder
    implements
        Builder<
          AdminExchangeConfigControllerGetAllConfigs200Response,
          AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder
        >,
        BasePaginationResponseDtoBuilder {
  _$AdminExchangeConfigControllerGetAllConfigs200Response? _$v;

  num? _total;
  num? get total => _$this._total;
  set total(covariant num? total) => _$this._total = total;

  num? _page;
  num? get page => _$this._page;
  set page(covariant num? page) => _$this._page = page;

  num? _limit;
  num? get limit => _$this._limit;
  set limit(covariant num? limit) => _$this._limit = limit;

  ListBuilder<JsonObject>? _items;
  ListBuilder<JsonObject> get items =>
      _$this._items ??= ListBuilder<JsonObject>();
  set items(covariant ListBuilder<JsonObject>? items) => _$this._items = items;

  AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder() {
    AdminExchangeConfigControllerGetAllConfigs200Response._defaults(this);
  }

  AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _total = $v.total;
      _page = $v.page;
      _limit = $v.limit;
      _items = $v.items.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(
    covariant AdminExchangeConfigControllerGetAllConfigs200Response other,
  ) {
    _$v = other as _$AdminExchangeConfigControllerGetAllConfigs200Response;
  }

  @override
  void update(
    void Function(AdminExchangeConfigControllerGetAllConfigs200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminExchangeConfigControllerGetAllConfigs200Response build() => _build();

  _$AdminExchangeConfigControllerGetAllConfigs200Response _build() {
    _$AdminExchangeConfigControllerGetAllConfigs200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminExchangeConfigControllerGetAllConfigs200Response._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'AdminExchangeConfigControllerGetAllConfigs200Response',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'AdminExchangeConfigControllerGetAllConfigs200Response',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'AdminExchangeConfigControllerGetAllConfigs200Response',
              'limit',
            ),
            items: items.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'items';
        items.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminExchangeConfigControllerGetAllConfigs200Response',
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
