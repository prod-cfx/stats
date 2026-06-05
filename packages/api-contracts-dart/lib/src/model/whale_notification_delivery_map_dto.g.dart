// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'whale_notification_delivery_map_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

class _$WhaleNotificationDeliveryMapDto
    extends WhaleNotificationDeliveryMapDto {
  @override
  final String web;
  @override
  final String email;
  @override
  final String telegram;

  factory _$WhaleNotificationDeliveryMapDto([
    void Function(WhaleNotificationDeliveryMapDtoBuilder)? updates,
  ]) => (WhaleNotificationDeliveryMapDtoBuilder()..update(updates))._build();

  _$WhaleNotificationDeliveryMapDto._({
    required this.web,
    required this.email,
    required this.telegram,
  }) : super._();
  @override
  WhaleNotificationDeliveryMapDto rebuild(
    void Function(WhaleNotificationDeliveryMapDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  WhaleNotificationDeliveryMapDtoBuilder toBuilder() =>
      WhaleNotificationDeliveryMapDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is WhaleNotificationDeliveryMapDto &&
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
    return (newBuiltValueToStringHelper(r'WhaleNotificationDeliveryMapDto')
          ..add('web', web)
          ..add('email', email)
          ..add('telegram', telegram))
        .toString();
  }
}

class WhaleNotificationDeliveryMapDtoBuilder
    implements
        Builder<
          WhaleNotificationDeliveryMapDto,
          WhaleNotificationDeliveryMapDtoBuilder
        > {
  _$WhaleNotificationDeliveryMapDto? _$v;

  String? _web;
  String? get web => _$this._web;
  set web(String? web) => _$this._web = web;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  String? _telegram;
  String? get telegram => _$this._telegram;
  set telegram(String? telegram) => _$this._telegram = telegram;

  WhaleNotificationDeliveryMapDtoBuilder() {
    WhaleNotificationDeliveryMapDto._defaults(this);
  }

  WhaleNotificationDeliveryMapDtoBuilder get _$this {
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
  void replace(WhaleNotificationDeliveryMapDto other) {
    _$v = other as _$WhaleNotificationDeliveryMapDto;
  }

  @override
  void update(void Function(WhaleNotificationDeliveryMapDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  WhaleNotificationDeliveryMapDto build() => _build();

  _$WhaleNotificationDeliveryMapDto _build() {
    final _$result =
        _$v ??
        _$WhaleNotificationDeliveryMapDto._(
          web: BuiltValueNullFieldError.checkNotNull(
            web,
            r'WhaleNotificationDeliveryMapDto',
            'web',
          ),
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'WhaleNotificationDeliveryMapDto',
            'email',
          ),
          telegram: BuiltValueNullFieldError.checkNotNull(
            telegram,
            r'WhaleNotificationDeliveryMapDto',
            'telegram',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
