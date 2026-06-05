// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_settings_controller_create_setting201_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminSettingsControllerCreateSetting201Response
    extends AdminSettingsControllerCreateSetting201Response {
  @override
  final SettingResponseDto? data;
  @override
  final String? message;

  factory _$AdminSettingsControllerCreateSetting201Response([
    void Function(AdminSettingsControllerCreateSetting201ResponseBuilder)?
    updates,
  ]) =>
      (AdminSettingsControllerCreateSetting201ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminSettingsControllerCreateSetting201Response._({this.data, this.message})
    : super._();
  @override
  AdminSettingsControllerCreateSetting201Response rebuild(
    void Function(AdminSettingsControllerCreateSetting201ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminSettingsControllerCreateSetting201ResponseBuilder toBuilder() =>
      AdminSettingsControllerCreateSetting201ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminSettingsControllerCreateSetting201Response &&
        data == other.data &&
        message == other.message;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, data.hashCode);
    _$hash = $jc(_$hash, message.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AdminSettingsControllerCreateSetting201Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminSettingsControllerCreateSetting201ResponseBuilder
    implements
        Builder<
          AdminSettingsControllerCreateSetting201Response,
          AdminSettingsControllerCreateSetting201ResponseBuilder
        > {
  _$AdminSettingsControllerCreateSetting201Response? _$v;

  SettingResponseDtoBuilder? _data;
  SettingResponseDtoBuilder get data =>
      _$this._data ??= SettingResponseDtoBuilder();
  set data(SettingResponseDtoBuilder? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminSettingsControllerCreateSetting201ResponseBuilder() {
    AdminSettingsControllerCreateSetting201Response._defaults(this);
  }

  AdminSettingsControllerCreateSetting201ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminSettingsControllerCreateSetting201Response other) {
    _$v = other as _$AdminSettingsControllerCreateSetting201Response;
  }

  @override
  void update(
    void Function(AdminSettingsControllerCreateSetting201ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminSettingsControllerCreateSetting201Response build() => _build();

  _$AdminSettingsControllerCreateSetting201Response _build() {
    _$AdminSettingsControllerCreateSetting201Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminSettingsControllerCreateSetting201Response._(
            data: _data?.build(),
            message: message,
          );
    } catch (_) {
      late String _$failedField;
      try {
        _$failedField = 'data';
        _data?.build();
      } catch (e) {
        throw BuiltValueNestedFieldError(
          r'AdminSettingsControllerCreateSetting201Response',
          _$failedField,
          e.toString(),
        );
      }
      rethrow;
    }
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
