// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'account_ai_quant_strategies_controller_list200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AccountAiQuantStrategiesControllerList200Response
    extends AccountAiQuantStrategiesControllerList200Response {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$AccountAiQuantStrategiesControllerList200Response([
    void Function(AccountAiQuantStrategiesControllerList200ResponseBuilder)?
    updates,
  ]) =>
      (AccountAiQuantStrategiesControllerList200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AccountAiQuantStrategiesControllerList200Response._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  AccountAiQuantStrategiesControllerList200Response rebuild(
    void Function(AccountAiQuantStrategiesControllerList200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AccountAiQuantStrategiesControllerList200ResponseBuilder toBuilder() =>
      AccountAiQuantStrategiesControllerList200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AccountAiQuantStrategiesControllerList200Response &&
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
            r'AccountAiQuantStrategiesControllerList200Response',
          )
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class AccountAiQuantStrategiesControllerList200ResponseBuilder
    implements
        Builder<
          AccountAiQuantStrategiesControllerList200Response,
          AccountAiQuantStrategiesControllerList200ResponseBuilder
        >,
        BasePaginationResponseDtoBuilder {
  _$AccountAiQuantStrategiesControllerList200Response? _$v;

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

  AccountAiQuantStrategiesControllerList200ResponseBuilder() {
    AccountAiQuantStrategiesControllerList200Response._defaults(this);
  }

  AccountAiQuantStrategiesControllerList200ResponseBuilder get _$this {
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
    covariant AccountAiQuantStrategiesControllerList200Response other,
  ) {
    _$v = other as _$AccountAiQuantStrategiesControllerList200Response;
  }

  @override
  void update(
    void Function(AccountAiQuantStrategiesControllerList200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AccountAiQuantStrategiesControllerList200Response build() => _build();

  _$AccountAiQuantStrategiesControllerList200Response _build() {
    _$AccountAiQuantStrategiesControllerList200Response _$result;
    try {
      _$result =
          _$v ??
          _$AccountAiQuantStrategiesControllerList200Response._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'AccountAiQuantStrategiesControllerList200Response',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'AccountAiQuantStrategiesControllerList200Response',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'AccountAiQuantStrategiesControllerList200Response',
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
          r'AccountAiQuantStrategiesControllerList200Response',
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
