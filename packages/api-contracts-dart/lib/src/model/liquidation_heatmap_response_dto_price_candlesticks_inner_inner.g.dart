// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'liquidation_heatmap_response_dto_price_candlesticks_inner_inner.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner
    extends LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner {
  @override
  final OneOf oneOf;

  factory _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner([
    void Function(
      LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder,
    )?
    updates,
  ]) =>
      (LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder()
            ..update(updates))
          ._build();

  _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner._({
    required this.oneOf,
  }) : super._();
  @override
  LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner rebuild(
    void Function(
      LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder,
    )
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder toBuilder() =>
      LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner &&
        oneOf == other.oneOf;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, oneOf.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner',
    )..add('oneOf', oneOf)).toString();
  }
}

class LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder
    implements
        Builder<
          LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner,
          LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder
        > {
  _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner? _$v;

  OneOf? _oneOf;
  OneOf? get oneOf => _$this._oneOf;
  set oneOf(OneOf? oneOf) => _$this._oneOf = oneOf;

  LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder() {
    LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner._defaults(this);
  }

  LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _oneOf = $v.oneOf;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner other) {
    _$v = other as _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner;
  }

  @override
  void update(
    void Function(
      LiquidationHeatmapResponseDtoPriceCandlesticksInnerInnerBuilder,
    )?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner build() => _build();

  _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner _build() {
    final _$result =
        _$v ??
        _$LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner._(
          oneOf: BuiltValueNullFieldError.checkNotNull(
            oneOf,
            r'LiquidationHeatmapResponseDtoPriceCandlesticksInnerInner',
            'oneOf',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
