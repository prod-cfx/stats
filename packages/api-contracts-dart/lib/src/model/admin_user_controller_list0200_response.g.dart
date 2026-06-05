// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_user_controller_list0200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminUserControllerList0200Response
    extends AdminUserControllerList0200Response {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$AdminUserControllerList0200Response([
    void Function(AdminUserControllerList0200ResponseBuilder)? updates,
  ]) =>
      (AdminUserControllerList0200ResponseBuilder()..update(updates))._build();

  _$AdminUserControllerList0200Response._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  AdminUserControllerList0200Response rebuild(
    void Function(AdminUserControllerList0200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminUserControllerList0200ResponseBuilder toBuilder() =>
      AdminUserControllerList0200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminUserControllerList0200Response &&
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
    return (newBuiltValueToStringHelper(r'AdminUserControllerList0200Response')
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class AdminUserControllerList0200ResponseBuilder
    implements
        Builder<
          AdminUserControllerList0200Response,
          AdminUserControllerList0200ResponseBuilder
        >,
        BasePaginationResponseDtoBuilder {
  _$AdminUserControllerList0200Response? _$v;

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

  AdminUserControllerList0200ResponseBuilder() {
    AdminUserControllerList0200Response._defaults(this);
  }

  AdminUserControllerList0200ResponseBuilder get _$this {
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
  void replace(covariant AdminUserControllerList0200Response other) {
    _$v = other as _$AdminUserControllerList0200Response;
  }

  @override
  void update(
    void Function(AdminUserControllerList0200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminUserControllerList0200Response build() => _build();

  _$AdminUserControllerList0200Response _build() {
    _$AdminUserControllerList0200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminUserControllerList0200Response._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'AdminUserControllerList0200Response',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'AdminUserControllerList0200Response',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'AdminUserControllerList0200Response',
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
          r'AdminUserControllerList0200Response',
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
