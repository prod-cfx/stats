// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'admin_settings_controller_get_all_settings200_response.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AdminSettingsControllerGetAllSettings200Response
    extends AdminSettingsControllerGetAllSettings200Response {
  @override
  final BuiltList<SettingResponseDto>? data;
  @override
  final String? message;

  factory _$AdminSettingsControllerGetAllSettings200Response([
    void Function(AdminSettingsControllerGetAllSettings200ResponseBuilder)?
    updates,
  ]) =>
      (AdminSettingsControllerGetAllSettings200ResponseBuilder()
            ..update(updates))
          ._build();

  _$AdminSettingsControllerGetAllSettings200Response._({
    this.data,
    this.message,
  }) : super._();
  @override
  AdminSettingsControllerGetAllSettings200Response rebuild(
    void Function(AdminSettingsControllerGetAllSettings200ResponseBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AdminSettingsControllerGetAllSettings200ResponseBuilder toBuilder() =>
      AdminSettingsControllerGetAllSettings200ResponseBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AdminSettingsControllerGetAllSettings200Response &&
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
            r'AdminSettingsControllerGetAllSettings200Response',
          )
          ..add('data', data)
          ..add('message', message))
        .toString();
  }
}

class AdminSettingsControllerGetAllSettings200ResponseBuilder
    implements
        Builder<
          AdminSettingsControllerGetAllSettings200Response,
          AdminSettingsControllerGetAllSettings200ResponseBuilder
        > {
  _$AdminSettingsControllerGetAllSettings200Response? _$v;

  ListBuilder<SettingResponseDto>? _data;
  ListBuilder<SettingResponseDto> get data =>
      _$this._data ??= ListBuilder<SettingResponseDto>();
  set data(ListBuilder<SettingResponseDto>? data) => _$this._data = data;

  String? _message;
  String? get message => _$this._message;
  set message(String? message) => _$this._message = message;

  AdminSettingsControllerGetAllSettings200ResponseBuilder() {
    AdminSettingsControllerGetAllSettings200Response._defaults(this);
  }

  AdminSettingsControllerGetAllSettings200ResponseBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _data = $v.data?.toBuilder();
      _message = $v.message;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AdminSettingsControllerGetAllSettings200Response other) {
    _$v = other as _$AdminSettingsControllerGetAllSettings200Response;
  }

  @override
  void update(
    void Function(AdminSettingsControllerGetAllSettings200ResponseBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AdminSettingsControllerGetAllSettings200Response build() => _build();

  _$AdminSettingsControllerGetAllSettings200Response _build() {
    _$AdminSettingsControllerGetAllSettings200Response _$result;
    try {
      _$result =
          _$v ??
          _$AdminSettingsControllerGetAllSettings200Response._(
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
          r'AdminSettingsControllerGetAllSettings200Response',
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
