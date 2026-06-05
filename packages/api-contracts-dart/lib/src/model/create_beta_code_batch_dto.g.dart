// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_beta_code_batch_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateBetaCodeBatchDto extends CreateBetaCodeBatchDto {
  @override
  final num count;
  @override
  final num maxUsesPerCode;

  factory _$CreateBetaCodeBatchDto([
    void Function(CreateBetaCodeBatchDtoBuilder)? updates,
  ]) => (CreateBetaCodeBatchDtoBuilder()..update(updates))._build();

  _$CreateBetaCodeBatchDto._({
    required this.count,
    required this.maxUsesPerCode,
  }) : super._();
  @override
  CreateBetaCodeBatchDto rebuild(
    void Function(CreateBetaCodeBatchDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateBetaCodeBatchDtoBuilder toBuilder() =>
      CreateBetaCodeBatchDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateBetaCodeBatchDto &&
        count == other.count &&
        maxUsesPerCode == other.maxUsesPerCode;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, count.hashCode);
    _$hash = $jc(_$hash, maxUsesPerCode.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'CreateBetaCodeBatchDto')
          ..add('count', count)
          ..add('maxUsesPerCode', maxUsesPerCode))
        .toString();
  }
}

class CreateBetaCodeBatchDtoBuilder
    implements Builder<CreateBetaCodeBatchDto, CreateBetaCodeBatchDtoBuilder> {
  _$CreateBetaCodeBatchDto? _$v;

  num? _count;
  num? get count => _$this._count;
  set count(num? count) => _$this._count = count;

  num? _maxUsesPerCode;
  num? get maxUsesPerCode => _$this._maxUsesPerCode;
  set maxUsesPerCode(num? maxUsesPerCode) =>
      _$this._maxUsesPerCode = maxUsesPerCode;

  CreateBetaCodeBatchDtoBuilder() {
    CreateBetaCodeBatchDto._defaults(this);
  }

  CreateBetaCodeBatchDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _count = $v.count;
      _maxUsesPerCode = $v.maxUsesPerCode;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateBetaCodeBatchDto other) {
    _$v = other as _$CreateBetaCodeBatchDto;
  }

  @override
  void update(void Function(CreateBetaCodeBatchDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateBetaCodeBatchDto build() => _build();

  _$CreateBetaCodeBatchDto _build() {
    final _$result =
        _$v ??
        _$CreateBetaCodeBatchDto._(
          count: BuiltValueNullFieldError.checkNotNull(
            count,
            r'CreateBetaCodeBatchDto',
            'count',
          ),
          maxUsesPerCode: BuiltValueNullFieldError.checkNotNull(
            maxUsesPerCode,
            r'CreateBetaCodeBatchDto',
            'maxUsesPerCode',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
