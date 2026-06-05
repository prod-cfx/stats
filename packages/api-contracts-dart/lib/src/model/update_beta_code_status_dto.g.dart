// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_beta_code_status_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateBetaCodeStatusDto extends UpdateBetaCodeStatusDto {
  @override
  final bool isActive;

  factory _$UpdateBetaCodeStatusDto([
    void Function(UpdateBetaCodeStatusDtoBuilder)? updates,
  ]) => (UpdateBetaCodeStatusDtoBuilder()..update(updates))._build();

  _$UpdateBetaCodeStatusDto._({required this.isActive}) : super._();
  @override
  UpdateBetaCodeStatusDto rebuild(
    void Function(UpdateBetaCodeStatusDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  UpdateBetaCodeStatusDtoBuilder toBuilder() =>
      UpdateBetaCodeStatusDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateBetaCodeStatusDto && isActive == other.isActive;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, isActive.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'UpdateBetaCodeStatusDto',
    )..add('isActive', isActive)).toString();
  }
}

class UpdateBetaCodeStatusDtoBuilder
    implements
        Builder<UpdateBetaCodeStatusDto, UpdateBetaCodeStatusDtoBuilder> {
  _$UpdateBetaCodeStatusDto? _$v;

  bool? _isActive;
  bool? get isActive => _$this._isActive;
  set isActive(bool? isActive) => _$this._isActive = isActive;

  UpdateBetaCodeStatusDtoBuilder() {
    UpdateBetaCodeStatusDto._defaults(this);
  }

  UpdateBetaCodeStatusDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _isActive = $v.isActive;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateBetaCodeStatusDto other) {
    _$v = other as _$UpdateBetaCodeStatusDto;
  }

  @override
  void update(void Function(UpdateBetaCodeStatusDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateBetaCodeStatusDto build() => _build();

  _$UpdateBetaCodeStatusDto _build() {
    final _$result =
        _$v ??
        _$UpdateBetaCodeStatusDto._(
          isActive: BuiltValueNullFieldError.checkNotNull(
            isActive,
            r'UpdateBetaCodeStatusDto',
            'isActive',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
