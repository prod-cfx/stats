// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'auth_controller_get_telegram_login_config200_response_data.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$AuthControllerGetTelegramLoginConfig200ResponseData
    extends AuthControllerGetTelegramLoginConfig200ResponseData {
  @override
  final String? botName;
  @override
  final bool betaCodeGateEnabled;

  factory _$AuthControllerGetTelegramLoginConfig200ResponseData([
    void Function(AuthControllerGetTelegramLoginConfig200ResponseDataBuilder)?
    updates,
  ]) =>
      (AuthControllerGetTelegramLoginConfig200ResponseDataBuilder()
            ..update(updates))
          ._build();

  _$AuthControllerGetTelegramLoginConfig200ResponseData._({
    this.botName,
    required this.betaCodeGateEnabled,
  }) : super._();
  @override
  AuthControllerGetTelegramLoginConfig200ResponseData rebuild(
    void Function(AuthControllerGetTelegramLoginConfig200ResponseDataBuilder)
    updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AuthControllerGetTelegramLoginConfig200ResponseDataBuilder toBuilder() =>
      AuthControllerGetTelegramLoginConfig200ResponseDataBuilder()
        ..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AuthControllerGetTelegramLoginConfig200ResponseData &&
        botName == other.botName &&
        betaCodeGateEnabled == other.betaCodeGateEnabled;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, botName.hashCode);
    _$hash = $jc(_$hash, betaCodeGateEnabled.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AuthControllerGetTelegramLoginConfig200ResponseData',
          )
          ..add('botName', botName)
          ..add('betaCodeGateEnabled', betaCodeGateEnabled))
        .toString();
  }
}

class AuthControllerGetTelegramLoginConfig200ResponseDataBuilder
    implements
        Builder<
          AuthControllerGetTelegramLoginConfig200ResponseData,
          AuthControllerGetTelegramLoginConfig200ResponseDataBuilder
        > {
  _$AuthControllerGetTelegramLoginConfig200ResponseData? _$v;

  String? _botName;
  String? get botName => _$this._botName;
  set botName(String? botName) => _$this._botName = botName;

  bool? _betaCodeGateEnabled;
  bool? get betaCodeGateEnabled => _$this._betaCodeGateEnabled;
  set betaCodeGateEnabled(bool? betaCodeGateEnabled) =>
      _$this._betaCodeGateEnabled = betaCodeGateEnabled;

  AuthControllerGetTelegramLoginConfig200ResponseDataBuilder() {
    AuthControllerGetTelegramLoginConfig200ResponseData._defaults(this);
  }

  AuthControllerGetTelegramLoginConfig200ResponseDataBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _botName = $v.botName;
      _betaCodeGateEnabled = $v.betaCodeGateEnabled;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AuthControllerGetTelegramLoginConfig200ResponseData other) {
    _$v = other as _$AuthControllerGetTelegramLoginConfig200ResponseData;
  }

  @override
  void update(
    void Function(AuthControllerGetTelegramLoginConfig200ResponseDataBuilder)?
    updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AuthControllerGetTelegramLoginConfig200ResponseData build() => _build();

  _$AuthControllerGetTelegramLoginConfig200ResponseData _build() {
    final _$result =
        _$v ??
        _$AuthControllerGetTelegramLoginConfig200ResponseData._(
          botName: botName,
          betaCodeGateEnabled: BuiltValueNullFieldError.checkNotNull(
            betaCodeGateEnabled,
            r'AuthControllerGetTelegramLoginConfig200ResponseData',
            'betaCodeGateEnabled',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
