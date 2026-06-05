// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'base_pagination_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

abstract mixin class BasePaginationResponseDtoBuilder {
  void replace(BasePaginationResponseDto other);
  void update(void Function(BasePaginationResponseDtoBuilder) updates);
  num? get total;
  set total(num? total);

  num? get page;
  set page(num? page);

  num? get limit;
  set limit(num? limit);

  ListBuilder<JsonObject> get items;
  set items(ListBuilder<JsonObject>? items);
}

class _$$BasePaginationResponseDto extends $BasePaginationResponseDto {
  @override
  final num total;
  @override
  final num page;
  @override
  final num limit;
  @override
  final BuiltList<JsonObject> items;

  factory _$$BasePaginationResponseDto([
    void Function($BasePaginationResponseDtoBuilder)? updates,
  ]) => ($BasePaginationResponseDtoBuilder()..update(updates))._build();

  _$$BasePaginationResponseDto._({
    required this.total,
    required this.page,
    required this.limit,
    required this.items,
  }) : super._();
  @override
  $BasePaginationResponseDto rebuild(
    void Function($BasePaginationResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  $BasePaginationResponseDtoBuilder toBuilder() =>
      $BasePaginationResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is $BasePaginationResponseDto &&
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
    return (newBuiltValueToStringHelper(r'$BasePaginationResponseDto')
          ..add('total', total)
          ..add('page', page)
          ..add('limit', limit)
          ..add('items', items))
        .toString();
  }
}

class $BasePaginationResponseDtoBuilder
    implements
        Builder<$BasePaginationResponseDto, $BasePaginationResponseDtoBuilder>,
        BasePaginationResponseDtoBuilder {
  _$$BasePaginationResponseDto? _$v;

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

  $BasePaginationResponseDtoBuilder() {
    $BasePaginationResponseDto._defaults(this);
  }

  $BasePaginationResponseDtoBuilder get _$this {
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
  void replace(covariant $BasePaginationResponseDto other) {
    _$v = other as _$$BasePaginationResponseDto;
  }

  @override
  void update(void Function($BasePaginationResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  $BasePaginationResponseDto build() => _build();

  _$$BasePaginationResponseDto _build() {
    _$$BasePaginationResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$$BasePaginationResponseDto._(
            total: BuiltValueNullFieldError.checkNotNull(
              total,
              r'$BasePaginationResponseDto',
              'total',
            ),
            page: BuiltValueNullFieldError.checkNotNull(
              page,
              r'$BasePaginationResponseDto',
              'page',
            ),
            limit: BuiltValueNullFieldError.checkNotNull(
              limit,
              r'$BasePaginationResponseDto',
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
          r'$BasePaginationResponseDto',
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
