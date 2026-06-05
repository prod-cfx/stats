// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'snapshot_total_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$SnapshotTotalDto extends SnapshotTotalDto {
  @override
  final num accountValue;
  @override
  final num perpPercent;
  @override
  final num spotPercent;

  factory _$SnapshotTotalDto([
    void Function(SnapshotTotalDtoBuilder)? updates,
  ]) => (SnapshotTotalDtoBuilder()..update(updates))._build();

  _$SnapshotTotalDto._({
    required this.accountValue,
    required this.perpPercent,
    required this.spotPercent,
  }) : super._();
  @override
  SnapshotTotalDto rebuild(void Function(SnapshotTotalDtoBuilder) updates) =>
      (toBuilder()..update(updates)).build();

  @override
  SnapshotTotalDtoBuilder toBuilder() =>
      SnapshotTotalDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SnapshotTotalDto &&
        accountValue == other.accountValue &&
        perpPercent == other.perpPercent &&
        spotPercent == other.spotPercent;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, accountValue.hashCode);
    _$hash = $jc(_$hash, perpPercent.hashCode);
    _$hash = $jc(_$hash, spotPercent.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SnapshotTotalDto')
          ..add('accountValue', accountValue)
          ..add('perpPercent', perpPercent)
          ..add('spotPercent', spotPercent))
        .toString();
  }
}

class SnapshotTotalDtoBuilder
    implements Builder<SnapshotTotalDto, SnapshotTotalDtoBuilder> {
  _$SnapshotTotalDto? _$v;

  num? _accountValue;
  num? get accountValue => _$this._accountValue;
  set accountValue(num? accountValue) => _$this._accountValue = accountValue;

  num? _perpPercent;
  num? get perpPercent => _$this._perpPercent;
  set perpPercent(num? perpPercent) => _$this._perpPercent = perpPercent;

  num? _spotPercent;
  num? get spotPercent => _$this._spotPercent;
  set spotPercent(num? spotPercent) => _$this._spotPercent = spotPercent;

  SnapshotTotalDtoBuilder() {
    SnapshotTotalDto._defaults(this);
  }

  SnapshotTotalDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _accountValue = $v.accountValue;
      _perpPercent = $v.perpPercent;
      _spotPercent = $v.spotPercent;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SnapshotTotalDto other) {
    _$v = other as _$SnapshotTotalDto;
  }

  @override
  void update(void Function(SnapshotTotalDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SnapshotTotalDto build() => _build();

  _$SnapshotTotalDto _build() {
    final _$result =
        _$v ??
        _$SnapshotTotalDto._(
          accountValue: BuiltValueNullFieldError.checkNotNull(
            accountValue,
            r'SnapshotTotalDto',
            'accountValue',
          ),
          perpPercent: BuiltValueNullFieldError.checkNotNull(
            perpPercent,
            r'SnapshotTotalDto',
            'perpPercent',
          ),
          spotPercent: BuiltValueNullFieldError.checkNotNull(
            spotPercent,
            r'SnapshotTotalDto',
            'spotPercent',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
