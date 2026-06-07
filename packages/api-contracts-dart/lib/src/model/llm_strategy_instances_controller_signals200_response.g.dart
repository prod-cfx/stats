// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'llm_strategy_instances_controller_signals200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$LlmStrategyInstancesControllerSignals200Response
    extends LlmStrategyInstancesControllerSignals200Response {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$LlmStrategyInstancesControllerSignals200Response([
    void Function(LlmStrategyInstancesControllerSignals200ResponseBuilder)?
    updates,
  ]) =>
      (LlmStrategyInstancesControllerSignals200ResponseBuilder()
            ..update(updates))
          ._build();

  _$LlmStrategyInstancesControllerSignals200Response._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  LlmStrategyInstancesControllerSignals200Response rebuild(
    void Function(LlmStrategyInstancesControllerSignals200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LlmStrategyInstancesControllerSignals200ResponseBuilder toBuilder() =>
      LlmStrategyInstancesControllerSignals200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LlmStrategyInstancesControllerSignals200Response &&
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
            r'LlmStrategyInstancesControllerSignals200Response',
          )
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class LlmStrategyInstancesControllerSignals200ResponseBuilder
    implements
        Builder<
          LlmStrategyInstancesControllerSignals200Response,
          LlmStrategyInstancesControllerSignals200ResponseBuilder
        >,
        BasePaginationResponseDtoBuilder {
  _$LlmStrategyInstancesControllerSignals200Response? _$v;

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

  LlmStrategyInstancesControllerSignals200ResponseBuilder() {
    LlmStrategyInstancesControllerSignals200Response._defaults(this);
  }

  LlmStrategyInstancesControllerSignals200ResponseBuilder get _$this {
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
    covariant LlmStrategyInstancesControllerSignals200Response other,
  ) {
    _$v = other as _$LlmStrategyInstancesControllerSignals200Response;
  }

  @override
  void update(
    void Function(LlmStrategyInstancesControllerSignals200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  LlmStrategyInstancesControllerSignals200Response build() => _build();

  _$LlmStrategyInstancesControllerSignals200Response _build() {
    _$LlmStrategyInstancesControllerSignals200Response _$result;
    try {
      _$result =
          _$v ??
          _$LlmStrategyInstancesControllerSignals200Response._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'LlmStrategyInstancesControllerSignals200Response',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'LlmStrategyInstancesControllerSignals200Response',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'LlmStrategyInstancesControllerSignals200Response',
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
          r'LlmStrategyInstancesControllerSignals200Response',
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
