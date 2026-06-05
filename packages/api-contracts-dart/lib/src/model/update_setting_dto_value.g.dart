// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'update_setting_dto_value.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$UpdateSettingDtoValue extends UpdateSettingDtoValue {
  @override
  final OneOf oneOf;

  factory _$UpdateSettingDtoValue([
    void Function(UpdateSettingDtoValueBuilder)? updates,
  ]) => (UpdateSettingDtoValueBuilder()..update(updates))._build();

  _$UpdateSettingDtoValue._({required this.oneOf}) : super._();
  @override
  UpdateSettingDtoValue rebuild(
    void Function(UpdateSettingDtoValueBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  UpdateSettingDtoValueBuilder toBuilder() =>
      UpdateSettingDtoValueBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is UpdateSettingDtoValue && oneOf == other.oneOf;
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
      r'UpdateSettingDtoValue',
    )..add('oneOf', oneOf)).toString();
  }
}

class UpdateSettingDtoValueBuilder
    implements Builder<UpdateSettingDtoValue, UpdateSettingDtoValueBuilder> {
  _$UpdateSettingDtoValue? _$v;

  OneOf? _oneOf;
  OneOf? get oneOf => _$this._oneOf;
  set oneOf(OneOf? oneOf) => _$this._oneOf = oneOf;

  UpdateSettingDtoValueBuilder() {
    UpdateSettingDtoValue._defaults(this);
  }

  UpdateSettingDtoValueBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _oneOf = $v.oneOf;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(UpdateSettingDtoValue other) {
    _$v = other as _$UpdateSettingDtoValue;
  }

  @override
  void update(void Function(UpdateSettingDtoValueBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  UpdateSettingDtoValue build() => _build();

  _$UpdateSettingDtoValue _build() {
    final _$result =
        _$v ??
        _$UpdateSettingDtoValue._(
          oneOf: BuiltValueNullFieldError.checkNotNull(
            oneOf,
            r'UpdateSettingDtoValue',
            'oneOf',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
