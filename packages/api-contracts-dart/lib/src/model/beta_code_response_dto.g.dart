// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'beta_code_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$BetaCodeResponseDto extends BetaCodeResponseDto {
  @override
  final String id;
  @override
  final String code;
  @override
  final num maxUses;
  @override
  final num usedCount;
  @override
  final bool isActive;
  @override
  final DateTime createdAt;

  factory _$BetaCodeResponseDto([
    void Function(BetaCodeResponseDtoBuilder)? updates,
  ]) => (BetaCodeResponseDtoBuilder()..update(updates))._build();

  _$BetaCodeResponseDto._({
    required this.id,
    required this.code,
    required this.maxUses,
    required this.usedCount,
    required this.isActive,
    required this.createdAt,
  }) : super._();
  @override
  BetaCodeResponseDto rebuild(
    void Function(BetaCodeResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  BetaCodeResponseDtoBuilder toBuilder() =>
      BetaCodeResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is BetaCodeResponseDto &&
        id == other.id &&
        code == other.code &&
        maxUses == other.maxUses &&
        usedCount == other.usedCount &&
        isActive == other.isActive &&
        createdAt == other.createdAt;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, id.hashCode);
    _$hash = $jc(_$hash, code.hashCode);
    _$hash = $jc(_$hash, maxUses.hashCode);
    _$hash = $jc(_$hash, usedCount.hashCode);
    _$hash = $jc(_$hash, isActive.hashCode);
    _$hash = $jc(_$hash, createdAt.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'BetaCodeResponseDto')
          ..add('id', id)
          ..add('code', code)
          ..add('maxUses', maxUses)
          ..add('usedCount', usedCount)
          ..add('isActive', isActive)
          ..add('createdAt', createdAt))
        .toString();
  }
}

class BetaCodeResponseDtoBuilder
    implements Builder<BetaCodeResponseDto, BetaCodeResponseDtoBuilder> {
  _$BetaCodeResponseDto? _$v;

  String? _id;
  String? get id => _$this._id;
  set id(String? id) => _$this._id = id;

  String? _code;
  String? get code => _$this._code;
  set code(String? code) => _$this._code = code;

  num? _maxUses;
  num? get maxUses => _$this._maxUses;
  set maxUses(num? maxUses) => _$this._maxUses = maxUses;

  num? _usedCount;
  num? get usedCount => _$this._usedCount;
  set usedCount(num? usedCount) => _$this._usedCount = usedCount;

  bool? _isActive;
  bool? get isActive => _$this._isActive;
  set isActive(bool? isActive) => _$this._isActive = isActive;

  DateTime? _createdAt;
  DateTime? get createdAt => _$this._createdAt;
  set createdAt(DateTime? createdAt) => _$this._createdAt = createdAt;

  BetaCodeResponseDtoBuilder() {
    BetaCodeResponseDto._defaults(this);
  }

  BetaCodeResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _id = $v.id;
      _code = $v.code;
      _maxUses = $v.maxUses;
      _usedCount = $v.usedCount;
      _isActive = $v.isActive;
      _createdAt = $v.createdAt;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(BetaCodeResponseDto other) {
    _$v = other as _$BetaCodeResponseDto;
  }

  @override
  void update(void Function(BetaCodeResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  BetaCodeResponseDto build() => _build();

  _$BetaCodeResponseDto _build() {
    final _$result =
        _$v ??
        _$BetaCodeResponseDto._(
          id: BuiltValueNullFieldError.checkNotNull(
            id,
            r'BetaCodeResponseDto',
            'id',
          ),
          code: BuiltValueNullFieldError.checkNotNull(
            code,
            r'BetaCodeResponseDto',
            'code',
          ),
          maxUses: BuiltValueNullFieldError.checkNotNull(
            maxUses,
            r'BetaCodeResponseDto',
            'maxUses',
          ),
          usedCount: BuiltValueNullFieldError.checkNotNull(
            usedCount,
            r'BetaCodeResponseDto',
            'usedCount',
          ),
          isActive: BuiltValueNullFieldError.checkNotNull(
            isActive,
            r'BetaCodeResponseDto',
            'isActive',
          ),
          createdAt: BuiltValueNullFieldError.checkNotNull(
            createdAt,
            r'BetaCodeResponseDto',
            'createdAt',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
