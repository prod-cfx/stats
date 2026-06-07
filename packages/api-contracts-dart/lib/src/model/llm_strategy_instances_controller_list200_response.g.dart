// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_strategy_instances_controller_list200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$LlmStrategyInstancesControllerList200Response
    extends LlmStrategyInstancesControllerList200Response {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$LlmStrategyInstancesControllerList200Response([
    void Function(LlmStrategyInstancesControllerList200ResponseBuilder)?
    updates,
  ]) =>
      (LlmStrategyInstancesControllerList200ResponseBuilder()..update(updates))
          ._build();

  _$LlmStrategyInstancesControllerList200Response._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  LlmStrategyInstancesControllerList200Response rebuild(
    void Function(LlmStrategyInstancesControllerList200ResponseBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmStrategyInstancesControllerList200ResponseBuilder toBuilder() =>
      LlmStrategyInstancesControllerList200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmStrategyInstancesControllerList200Response &&
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
            r'LlmStrategyInstancesControllerList200Response',
          )
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class LlmStrategyInstancesControllerList200ResponseBuilder
    implements
        Builder<
          LlmStrategyInstancesControllerList200Response,
          LlmStrategyInstancesControllerList200ResponseBuilder
        >,
        BasePaginationResponseDtoBuilder {
  _$LlmStrategyInstancesControllerList200Response? _$v;

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

  LlmStrategyInstancesControllerList200ResponseBuilder() {
    LlmStrategyInstancesControllerList200Response._defaults(this);
  }

  LlmStrategyInstancesControllerList200ResponseBuilder get _$this {
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
  void replace(covariant LlmStrategyInstancesControllerList200Response other) {
    _$v = other as _$LlmStrategyInstancesControllerList200Response;
  }

  @override
  void update(
    void Function(LlmStrategyInstancesControllerList200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  LlmStrategyInstancesControllerList200Response build() => _build();

  _$LlmStrategyInstancesControllerList200Response _build() {
    _$LlmStrategyInstancesControllerList200Response _$result;
    try {
      _$result =
          _$v ??
          _$LlmStrategyInstancesControllerList200Response._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'LlmStrategyInstancesControllerList200Response',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'LlmStrategyInstancesControllerList200Response',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'LlmStrategyInstancesControllerList200Response',
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
          r'LlmStrategyInstancesControllerList200Response',
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
