// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_address_performance_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleAddressPerformanceResponseDto
    extends WhaleAddressPerformanceResponseDto {
  @override
  final WhaleTraderSummaryPerformanceDto summary;
  @override
  final BuiltList<WhaleAssetPerformanceDto> byAsset;
  @override
  final BuiltList<WhaleTradeHistoryItemDto> trades;

  factory _$WhaleAddressPerformanceResponseDto([
    void Function(WhaleAddressPerformanceResponseDtoBuilder)? updates,
  ]) => (WhaleAddressPerformanceResponseDtoBuilder()..update(updates))._build();

  _$WhaleAddressPerformanceResponseDto._({
    required this.summary,
    required this.byAsset,
    required this.trades,
  }) : super._();
  @override
  WhaleAddressPerformanceResponseDto rebuild(
    void Function(WhaleAddressPerformanceResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleAddressPerformanceResponseDtoBuilder toBuilder() =>
      WhaleAddressPerformanceResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleAddressPerformanceResponseDto &&
        summary == other.summary &&
        byAsset == other.byAsset &&
        trades == other.trades;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, summary.hashCode);
    _$hash = $jc(_$hash, byAsset.hashCode);
    _$hash = $jc(_$hash, trades.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleAddressPerformanceResponseDto')
          ..add('summary', summary)
          ..add('byAsset', byAsset)
          ..add('trades', trades))
        .toString();
  }
}

class WhaleAddressPerformanceResponseDtoBuilder
    implements
        Builder<
          WhaleAddressPerformanceResponseDto,
          WhaleAddressPerformanceResponseDtoBuilder
        > {
  _$WhaleAddressPerformanceResponseDto? _$v;

  WhaleTraderSummaryPerformanceDtoBuilder? _summary;
  WhaleTraderSummaryPerformanceDtoBuilder get summary =>
      _$this._summary ??= WhaleTraderSummaryPerformanceDtoBuilder();
  set summary(WhaleTraderSummaryPerformanceDtoBuilder? summary) =>
      _$this._summary = summary;

  ListBuilder<WhaleAssetPerformanceDto>? _byAsset;
  ListBuilder<WhaleAssetPerformanceDto> get byAsset =>
      _$this._byAsset ??= ListBuilder<WhaleAssetPerformanceDto>();
  set byAsset(ListBuilder<WhaleAssetPerformanceDto>? byAsset) =>
      _$this._byAsset = byAsset;

  ListBuilder<WhaleTradeHistoryItemDto>? _trades;
  ListBuilder<WhaleTradeHistoryItemDto> get trades =>
      _$this._trades ??= ListBuilder<WhaleTradeHistoryItemDto>();
  set trades(ListBuilder<WhaleTradeHistoryItemDto>? trades) =>
      _$this._trades = trades;

  WhaleAddressPerformanceResponseDtoBuilder() {
    WhaleAddressPerformanceResponseDto._defaults(this);
  }

  WhaleAddressPerformanceResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _summary = $v.summary.toBuilder();
      _byAsset = $v.byAsset.toBuilder();
      _trades = $v.trades.toBuilder();
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleAddressPerformanceResponseDto other) {
    _$v = other as _$WhaleAddressPerformanceResponseDto;
  }

  @override
  void update(
    void Function(WhaleAddressPerformanceResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  WhaleAddressPerformanceResponseDto build() => _build();

  _$WhaleAddressPerformanceResponseDto _build() {
    _$WhaleAddressPerformanceResponseDto _$result;
    try {
      _$result =
          _$v ??
          _$WhaleAddressPerformanceResponseDto._(
            summary: summary.build(),
            byAsset: byAsset.build(),
            trades: trades.build(),
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'summary';
        summary.build();
        _$failedField = 'byAsset';
        byAsset.build();
        _$failedField = 'trades';
        trades.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'WhaleAddressPerformanceResponseDto',
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
