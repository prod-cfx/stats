// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'create_setting_dto_value.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$CreateSettingDtoValue extends CreateSettingDtoValue {
  @override
  final OneOf oneOf;

  factory _$CreateSettingDtoValue([
    void Function(CreateSettingDtoValueBuilder)? updates,
  ]) => (CreateSettingDtoValueBuilder()..update(updates))._build();

  _$CreateSettingDtoValue._({required this.oneOf}) : super._();
  @override
  CreateSettingDtoValue rebuild(
    void Function(CreateSettingDtoValueBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CreateSettingDtoValueBuilder toBuilder() =>
      CreateSettingDtoValueBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CreateSettingDtoValue && oneOf == other.oneOf;
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
      r'CreateSettingDtoValue',
    )..add('oneOf', oneOf)).toString();
  }
}

class CreateSettingDtoValueBuilder
    implements Builder<CreateSettingDtoValue, CreateSettingDtoValueBuilder> {
  _$CreateSettingDtoValue? _$v;

  OneOf? _oneOf;
  OneOf? get oneOf => _$this._oneOf;
  set oneOf(OneOf? oneOf) => _$this._oneOf = oneOf;

  CreateSettingDtoValueBuilder() {
    CreateSettingDtoValue._defaults(this);
  }

  CreateSettingDtoValueBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _oneOf = $v.oneOf;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CreateSettingDtoValue other) {
    _$v = other as _$CreateSettingDtoValue;
  }

  @override
  void update(void Function(CreateSettingDtoValueBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  CreateSettingDtoValue build() => _build();

  _$CreateSettingDtoValue _build() {
    final _$result =
        _$v ??
        _$CreateSettingDtoValue._(
          oneOf: BuiltValueNullFieldError.checkNotNull(
            oneOf,
            r'CreateSettingDtoValue',
            'oneOf',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
