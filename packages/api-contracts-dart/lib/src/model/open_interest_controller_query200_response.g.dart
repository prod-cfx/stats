// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'open_interest_controller_query200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$OpenInterestControllerQuery200Response
    extends OpenInterestControllerQuery200Response {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$OpenInterestControllerQuery200Response([
    void Function(OpenInterestControllerQuery200ResponseBuilder)? updates,
  ]) => (OpenInterestControllerQuery200ResponseBuilder()..update(updates))
      ._build();

  _$OpenInterestControllerQuery200Response._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  OpenInterestControllerQuery200Response rebuild(
    void Function(OpenInterestControllerQuery200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  OpenInterestControllerQuery200ResponseBuilder toBuilder() =>
      OpenInterestControllerQuery200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is OpenInterestControllerQuery200Response &&
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
            r'OpenInterestControllerQuery200Response',
          )
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class OpenInterestControllerQuery200ResponseBuilder
    implements
        Builder<
          OpenInterestControllerQuery200Response,
          OpenInterestControllerQuery200ResponseBuilder
        >,
        BasePaginationResponseDtoBuilder {
  _$OpenInterestControllerQuery200Response? _$v;

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

  OpenInterestControllerQuery200ResponseBuilder() {
    OpenInterestControllerQuery200Response._defaults(this);
  }

  OpenInterestControllerQuery200ResponseBuilder get _$this {
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
  void replace(covariant OpenInterestControllerQuery200Response other) {
    _$v = other as _$OpenInterestControllerQuery200Response;
  }

  @override
  void update(
    void Function(OpenInterestControllerQuery200ResponseBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  OpenInterestControllerQuery200Response build() => _build();

  _$OpenInterestControllerQuery200Response _build() {
    _$OpenInterestControllerQuery200Response _$result;
    try {
      _$result =
          _$v ??
          _$OpenInterestControllerQuery200Response._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'OpenInterestControllerQuery200Response',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'OpenInterestControllerQuery200Response',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'OpenInterestControllerQuery200Response',
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
          r'OpenInterestControllerQuery200Response',
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
