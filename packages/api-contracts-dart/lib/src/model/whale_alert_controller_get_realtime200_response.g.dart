// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_alert_controller_get_realtime200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleAlertControllerGetRealtime200Response
    extends WhaleAlertControllerGetRealtime200Response {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$WhaleAlertControllerGetRealtime200Response([
    void Function(WhaleAlertControllerGetRealtime200ResponseBuilder)? updates,
  ]) => (WhaleAlertControllerGetRealtime200ResponseBuilder()..update(updates))
      ._build();

  _$WhaleAlertControllerGetRealtime200Response._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  WhaleAlertControllerGetRealtime200Response rebuild(
    void Function(WhaleAlertControllerGetRealtime200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleAlertControllerGetRealtime200ResponseBuilder toBuilder() =>
      WhaleAlertControllerGetRealtime200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleAlertControllerGetRealtime200Response &&
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
            r'WhaleAlertControllerGetRealtime200Response',
          )
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class WhaleAlertControllerGetRealtime200ResponseBuilder
    implements
        Builder<
          WhaleAlertControllerGetRealtime200Response,
          WhaleAlertControllerGetRealtime200ResponseBuilder
        >,
        BasePaginationResponseDtoBuilder {
  _$WhaleAlertControllerGetRealtime200Response? _$v;

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

  WhaleAlertControllerGetRealtime200ResponseBuilder() {
    WhaleAlertControllerGetRealtime200Response._defaults(this);
  }

  WhaleAlertControllerGetRealtime200ResponseBuilder get _$this {
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
  void replace(covariant WhaleAlertControllerGetRealtime200Response other) {
    _$v = other as _$WhaleAlertControllerGetRealtime200Response;
  }

  @override
  void update(
    void Function(WhaleAlertControllerGetRealtime200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  WhaleAlertControllerGetRealtime200Response build() => _build();

  _$WhaleAlertControllerGetRealtime200Response _build() {
    _$WhaleAlertControllerGetRealtime200Response _$result;
    try {
      _$result =
          _$v ??
          _$WhaleAlertControllerGetRealtime200Response._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'WhaleAlertControllerGetRealtime200Response',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'WhaleAlertControllerGetRealtime200Response',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'WhaleAlertControllerGetRealtime200Response',
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
          r'WhaleAlertControllerGetRealtime200Response',
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
