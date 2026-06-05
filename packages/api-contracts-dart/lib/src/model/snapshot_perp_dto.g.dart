// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'snapshot_perp_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SnapshotPerpDto extends SnapshotPerpDto {
  @override
  final num accountValue;
  @override
  final num totalMarginUsed;
  @override
  final num totalPositionValue;
  @override
  final num withdrawable;
  @override
  final num marginUsagePercent;
  @override
  final num leverageRatio;
  @override
  final num unrealizedPnl;
  @override
  final num roi;

  factory _$SnapshotPerpDto([void Function(SnapshotPerpDtoBuilder)? updates]) =>
      (SnapshotPerpDtoBuilder()..update(updates))._build();

  _$SnapshotPerpDto._({
    required this.accountValue,
    required this.totalMarginUsed,
    required this.totalPositionValue,
    required this.withdrawable,
    required this.marginUsagePercent,
    required this.leverageRatio,
    required this.unrealizedPnl,
    required this.roi,
  }) : super._();
  @override
  SnapshotPerpDto rebuild(void Function(SnapshotPerpDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SnapshotPerpDtoBuilder toBuilder() => SnapshotPerpDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SnapshotPerpDto &&
        accountValue == other.accountValue &&
        totalMarginUsed == other.totalMarginUsed &&
        totalPositionValue == other.totalPositionValue &&
        withdrawable == other.withdrawable &&
        marginUsagePercent == other.marginUsagePercent &&
        leverageRatio == other.leverageRatio &&
        unrealizedPnl == other.unrealizedPnl &&
        roi == other.roi;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, accountValue.hashCode);
    _$hash = $jc(_$hash, totalMarginUsed.hashCode);
    _$hash = $jc(_$hash, totalPositionValue.hashCode);
    _$hash = $jc(_$hash, withdrawable.hashCode);
    _$hash = $jc(_$hash, marginUsagePercent.hashCode);
    _$hash = $jc(_$hash, leverageRatio.hashCode);
    _$hash = $jc(_$hash, unrealizedPnl.hashCode);
    _$hash = $jc(_$hash, roi.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SnapshotPerpDto')
          ..add('accountValue', accountValue)
          ..add('totalMarginUsed', totalMarginUsed)
          ..add('totalPositionValue', totalPositionValue)
          ..add('withdrawable', withdrawable)
          ..add('marginUsagePercent', marginUsagePercent)
          ..add('leverageRatio', leverageRatio)
          ..add('unrealizedPnl', unrealizedPnl)
          ..add('roi', roi))
        .toString();
  }
}

class SnapshotPerpDtoBuilder
    implements Builder<SnapshotPerpDto, SnapshotPerpDtoBuilder> {
  _$SnapshotPerpDto? _$v;

  num? _accountValue;
  num? get accountValue => _$this._accountValue;
  set accountValue(num? accountValue) => _$this._accountValue = accountValue;

  num? _totalMarginUsed;
  num? get totalMarginUsed => _$this._totalMarginUsed;
  set totalMarginUsed(num? totalMarginUsed) =>
      _$this._totalMarginUsed = totalMarginUsed;

  num? _totalPositionValue;
  num? get totalPositionValue => _$this._totalPositionValue;
  set totalPositionValue(num? totalPositionValue) =>
      _$this._totalPositionValue = totalPositionValue;

  num? _withdrawable;
  num? get withdrawable => _$this._withdrawable;
  set withdrawable(num? withdrawable) => _$this._withdrawable = withdrawable;

  num? _marginUsagePercent;
  num? get marginUsagePercent => _$this._marginUsagePercent;
  set marginUsagePercent(num? marginUsagePercent) =>
      _$this._marginUsagePercent = marginUsagePercent;

  num? _leverageRatio;
  num? get leverageRatio => _$this._leverageRatio;
  set leverageRatio(num? leverageRatio) =>
      _$this._leverageRatio = leverageRatio;

  num? _unrealizedPnl;
  num? get unrealizedPnl => _$this._unrealizedPnl;
  set unrealizedPnl(num? unrealizedPnl) =>
      _$this._unrealizedPnl = unrealizedPnl;

  num? _roi;
  num? get roi => _$this._roi;
  set roi(num? roi) => _$this._roi = roi;

  SnapshotPerpDtoBuilder() {
    SnapshotPerpDto._defaults(this);
  }

  SnapshotPerpDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _accountValue = $v.accountValue;
      _totalMarginUsed = $v.totalMarginUsed;
      _totalPositionValue = $v.totalPositionValue;
      _withdrawable = $v.withdrawable;
      _marginUsagePercent = $v.marginUsagePercent;
      _leverageRatio = $v.leverageRatio;
      _unrealizedPnl = $v.unrealizedPnl;
      _roi = $v.roi;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SnapshotPerpDto other) {
    _$v = other as _$SnapshotPerpDto;
  }

  @override
  void update(void Function(SnapshotPerpDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SnapshotPerpDto build() => _build();

  _$SnapshotPerpDto _build() {
    final _$result =
        _$v ??
        _$SnapshotPerpDto._(
          accountValue: BuiltValueNullFieldError.checkNotNull(
            accountValue,
            r'SnapshotPerpDto',
            'accountValue',
          ),
          totalMarginUsed: BuiltValueNullFieldError.checkNotNull(
            totalMarginUsed,
            r'SnapshotPerpDto',
            'totalMarginUsed',
          ),
          totalPositionValue: BuiltValueNullFieldError.checkNotNull(
            totalPositionValue,
            r'SnapshotPerpDto',
            'totalPositionValue',
          ),
          withdrawable: BuiltValueNullFieldError.checkNotNull(
            withdrawable,
            r'SnapshotPerpDto',
            'withdrawable',
          ),
          marginUsagePercent: BuiltValueNullFieldError.checkNotNull(
            marginUsagePercent,
            r'SnapshotPerpDto',
            'marginUsagePercent',
          ),
          leverageRatio: BuiltValueNullFieldError.checkNotNull(
            leverageRatio,
            r'SnapshotPerpDto',
            'leverageRatio',
          ),
          unrealizedPnl: BuiltValueNullFieldError.checkNotNull(
            unrealizedPnl,
            r'SnapshotPerpDto',
            'unrealizedPnl',
          ),
          roi: BuiltValueNullFieldError.checkNotNull(
            roi,
            r'SnapshotPerpDto',
            'roi',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
