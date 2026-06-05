// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_settings_controller_reload_settings200_response_data.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminSettingsControllerReloadSettings200ResponseData
    extends AdminSettingsControllerReloadSettings200ResponseData {
  @override
  final bool? success;

  factory _$AdminSettingsControllerReloadSettings200ResponseData([
    void Function(AdminSettingsControllerReloadSettings200ResponseDataBuilder)?
    updates,
  ]) =>
      (AdminSettingsControllerReloadSettings200ResponseDataBuilder()
            ..update(updates))
          ._build();

  _$AdminSettingsControllerReloadSettings200ResponseData._({this.success})
    : super._();
  @override
  AdminSettingsControllerReloadSettings200ResponseData rebuild(
    void Function(AdminSettingsControllerReloadSettings200ResponseDataBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminSettingsControllerReloadSettings200ResponseDataBuilder toBuilder() =>
      AdminSettingsControllerReloadSettings200ResponseDataBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminSettingsControllerReloadSettings200ResponseData &&
        success == other.success;
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
      r'AdminSettingsControllerReloadSettings200ResponseData',
    )..add('success', success)).toString();
  }
}

class AdminSettingsControllerReloadSettings200ResponseDataBuilder
    implements
        Builder<
          AdminSettingsControllerReloadSettings200ResponseData,
          AdminSettingsControllerReloadSettings200ResponseDataBuilder
        > {
  _$AdminSettingsControllerReloadSettings200ResponseData? _$v;

  bool? _success;
  bool? get success => _$this._success;
  set success(bool? success) => _$this._success = success;

  AdminSettingsControllerReloadSettings200ResponseDataBuilder() {
    AdminSettingsControllerReloadSettings200ResponseData._defaults(this);
  }

  AdminSettingsControllerReloadSettings200ResponseDataBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _success = $v.success;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminSettingsControllerReloadSettings200ResponseData other) {
    _$v = other as _$AdminSettingsControllerReloadSettings200ResponseData;
  }

  @override
  void update(
    void Function(AdminSettingsControllerReloadSettings200ResponseDataBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminSettingsControllerReloadSettings200ResponseData build() => _build();

  _$AdminSettingsControllerReloadSettings200ResponseData _build() {
    final _$result =
        _$v ??
        _$AdminSettingsControllerReloadSettings200ResponseData._(
          success: success,
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
