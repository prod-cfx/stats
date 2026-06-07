// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_delete_result_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminDeleteResultResponseDto extends AdminDeleteResultResponseDto {
  @override
  final bool success;

  factory _$AdminDeleteResultResponseDto([
    void Function(AdminDeleteResultResponseDtoBuilder)? updates,
  ]) => (AdminDeleteResultResponseDtoBuilder()..update(updates))._build();

  _$AdminDeleteResultResponseDto._({required this.success}) : super._();
  @override
  AdminDeleteResultResponseDto rebuild(
    void Function(AdminDeleteResultResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminDeleteResultResponseDtoBuilder toBuilder() =>
      AdminDeleteResultResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminDeleteResultResponseDto && success == other.success;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, success.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
      r'AdminDeleteResultResponseDto',
    )..add('success', success)).toString();
  }
}

class AdminDeleteResultResponseDtoBuilder
    implements
        Builder<
          AdminDeleteResultResponseDto,
          AdminDeleteResultResponseDtoBuilder
        > {
  _$AdminDeleteResultResponseDto? _$v;

  bool? _success;
  bool? get success => _$this._success;
  set success(bool? success) => _$this._success = success;

  AdminDeleteResultResponseDtoBuilder() {
    AdminDeleteResultResponseDto._defaults(this);
  }

  AdminDeleteResultResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _success = $v.success;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminDeleteResultResponseDto other) {
    _$v = other as _$AdminDeleteResultResponseDto;
  }

  @override
  void update(void Function(AdminDeleteResultResponseDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  AdminDeleteResultResponseDto build() => _build();

  _$AdminDeleteResultResponseDto _build() {
    final _$result =
        _$v ??
        _$AdminDeleteResultResponseDto._(
          success: BuiltValueNullFieldError.checkNotNull(
            success,
            r'AdminDeleteResultResponseDto',
            'success',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
