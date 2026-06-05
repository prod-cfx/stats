// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'aggregated_liquidation_summary_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AggregatedLiquidationSummaryDto
    extends AggregatedLiquidationSummaryDto {
  @override
  final String symbol;
  @override
  final BuiltList<LiquidationSummaryItemDto> items;

  factory _$AggregatedLiquidationSummaryDto([
    void Function(AggregatedLiquidationSummaryDtoBuilder)? updates,
  ]) => (AggregatedLiquidationSummaryDtoBuilder()..update(updates))._build();

  _$AggregatedLiquidationSummaryDto._({
    required this.symbol,
    required this.items,
  }) : super._();
  @override
  AggregatedLiquidationSummaryDto rebuild(
    void Function(AggregatedLiquidationSummaryDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AggregatedLiquidationSummaryDtoBuilder toBuilder() =>
      AggregatedLiquidationSummaryDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AggregatedLiquidationSummaryDto &&
        symbol == other.symbol &&
        items == other.items;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, symbol.hashCode);
    _$hash = $jc(_$hash, items.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'AggregatedLiquidationSummaryDto')
          ..add('symbol', symbol)
          ..add('items', items))
        .toString();
  }
}

class AggregatedLiquidationSummaryDtoBuilder
    implements
        Builder<
          AggregatedLiquidationSummaryDto,
          AggregatedLiquidationSummaryDtoBuilder
        > {
  _$AggregatedLiquidationSummaryDto? _$v;

  String? _symbol;
  String? get symbol => _$this._symbol;
  set symbol(String? symbol) => _$this._symbol = symbol;

  ListBuilder<LiquidationSummaryItemDto>? _items;
  ListBuilder<LiquidationSummaryItemDto> get items =>
      _$this._items ??= ListBuilder<LiquidationSummaryItemDto>();
  set items(ListBuilder<LiquidationSummaryItemDto>? items) =>
      _$this._items = items;

  AggregatedLiquidationSummaryDtoBuilder() {
    AggregatedLiquidationSummaryDto._defaults(this);
  }

  AggregatedLiquidationSummaryDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _symbol = $v.symbol;
      _items = $v.items.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AggregatedLiquidationSummaryDto other) {
    _$v = other as _$AggregatedLiquidationSummaryDto;
  }

  @override
  void update(void Function(AggregatedLiquidationSummaryDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AggregatedLiquidationSummaryDto build() => _build();

  _$AggregatedLiquidationSummaryDto _build() {
    _$AggregatedLiquidationSummaryDto _$result;
    try {
      _$result =
          _$v ??
          _$AggregatedLiquidationSummaryDto._(
            symbol: BuiltValueNullFieldError.checkNotNull(
              symbol,
              r'AggregatedLiquidationSummaryDto',
              'symbol',
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
          r'AggregatedLiquidationSummaryDto',
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
