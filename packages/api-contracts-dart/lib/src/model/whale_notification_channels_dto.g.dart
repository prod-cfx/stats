// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_notification_channels_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleNotificationChannelsDto extends WhaleNotificationChannelsDto {
  @override
  final bool web;
  @override
  final bool email;
  @override
  final bool telegram;

  factory _$WhaleNotificationChannelsDto([
    void Function(WhaleNotificationChannelsDtoBuilder)? updates,
  ]) => (WhaleNotificationChannelsDtoBuilder()..update(updates))._build();

  _$WhaleNotificationChannelsDto._({
    required this.web,
    required this.email,
    required this.telegram,
  }) : super._();
  @override
  WhaleNotificationChannelsDto rebuild(
    void Function(WhaleNotificationChannelsDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleNotificationChannelsDtoBuilder toBuilder() =>
      WhaleNotificationChannelsDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleNotificationChannelsDto &&
        web == other.web &&
        email == other.email &&
        telegram == other.telegram;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, web.hashCode);
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, telegram.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'WhaleNotificationChannelsDto')
          ..add('web', web)
          ..add('email', email)
          ..add('telegram', telegram))
        .toString();
  }
}

class WhaleNotificationChannelsDtoBuilder
    implements
        Builder<
          WhaleNotificationChannelsDto,
          WhaleNotificationChannelsDtoBuilder
        > {
  _$WhaleNotificationChannelsDto? _$v;

  bool? _web;
  bool? get web => _$this._web;
  set web(bool? web) => _$this._web = web;

  bool? _email;
  bool? get email => _$this._email;
  set email(bool? email) => _$this._email = email;

  bool? _telegram;
  bool? get telegram => _$this._telegram;
  set telegram(bool? telegram) => _$this._telegram = telegram;

  WhaleNotificationChannelsDtoBuilder() {
    WhaleNotificationChannelsDto._defaults(this);
  }

  WhaleNotificationChannelsDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _web = $v.web;
      _email = $v.email;
      _telegram = $v.telegram;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(WhaleNotificationChannelsDto other) {
    _$v = other as _$WhaleNotificationChannelsDto;
  }

  @override
  void update(void Function(WhaleNotificationChannelsDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleNotificationChannelsDto build() => _build();

  _$WhaleNotificationChannelsDto _build() {
    final _$result =
        _$v ??
        _$WhaleNotificationChannelsDto._(
          web: BuiltValueNullFieldError.checkNotNull(
            web,
            r'WhaleNotificationChannelsDto',
            'web',
          ),
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'WhaleNotificationChannelsDto',
            'email',
          ),
          telegram: BuiltValueNullFieldError.checkNotNull(
            telegram,
            r'WhaleNotificationChannelsDto',
            'telegram',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
