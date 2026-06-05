// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'send_verification_code_request_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const SendVerificationCodeRequestDtoPurposeEnum
_$sendVerificationCodeRequestDtoPurposeEnum_EMAIL_VERIFICATION =
    const SendVerificationCodeRequestDtoPurposeEnum._('EMAIL_VERIFICATION');
const SendVerificationCodeRequestDtoPurposeEnum
_$sendVerificationCodeRequestDtoPurposeEnum_PASSWORD_RESET =
    const SendVerificationCodeRequestDtoPurposeEnum._('PASSWORD_RESET');

SendVerificationCodeRequestDtoPurposeEnum
_$sendVerificationCodeRequestDtoPurposeEnumValueOf(String name) {
  switch (name) {
    case 'EMAIL_VERIFICATION':
      return _$sendVerificationCodeRequestDtoPurposeEnum_EMAIL_VERIFICATION;
    case 'PASSWORD_RESET':
      return _$sendVerificationCodeRequestDtoPurposeEnum_PASSWORD_RESET;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<SendVerificationCodeRequestDtoPurposeEnum>
_$sendVerificationCodeRequestDtoPurposeEnumValues =
    BuiltSet<SendVerificationCodeRequestDtoPurposeEnum>(
      const <SendVerificationCodeRequestDtoPurposeEnum>[
        _$sendVerificationCodeRequestDtoPurposeEnum_EMAIL_VERIFICATION,
        _$sendVerificationCodeRequestDtoPurposeEnum_PASSWORD_RESET,
      ],
    );

Serializer<SendVerificationCodeRequestDtoPurposeEnum>
_$sendVerificationCodeRequestDtoPurposeEnumSerializer =
    _$SendVerificationCodeRequestDtoPurposeEnumSerializer();

class _$SendVerificationCodeRequestDtoPurposeEnumSerializer
    implements PrimitiveSerializer<SendVerificationCodeRequestDtoPurposeEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'EMAIL_VERIFICATION': 'EMAIL_VERIFICATION',
    'PASSWORD_RESET': 'PASSWORD_RESET',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'EMAIL_VERIFICATION': 'EMAIL_VERIFICATION',
    'PASSWORD_RESET': 'PASSWORD_RESET',
  };

  @override
  final Iterable<Type> types = const <Type>[
    SendVerificationCodeRequestDtoPurposeEnum,
  ];
  @override
  final String wireName = 'SendVerificationCodeRequestDtoPurposeEnum';

  @override
  Object serialize(
    Serializers serializers,
    SendVerificationCodeRequestDtoPurposeEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  SendVerificationCodeRequestDtoPurposeEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => SendVerificationCodeRequestDtoPurposeEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$SendVerificationCodeRequestDto extends SendVerificationCodeRequestDto {
  @override
  final String email;
  @override
  final SendVerificationCodeRequestDtoPurposeEnum purpose;

  factory _$SendVerificationCodeRequestDto([
    void Function(SendVerificationCodeRequestDtoBuilder)? updates,
  ]) => (SendVerificationCodeRequestDtoBuilder()..update(updates))._build();

  _$SendVerificationCodeRequestDto._({
    required this.email,
    required this.purpose,
  }) : super._();
  @override
  SendVerificationCodeRequestDto rebuild(
    void Function(SendVerificationCodeRequestDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  SendVerificationCodeRequestDtoBuilder toBuilder() =>
      SendVerificationCodeRequestDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is SendVerificationCodeRequestDto &&
        email == other.email &&
        purpose == other.purpose;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, email.hashCode);
    _$hash = $jc(_$hash, purpose.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(r'SendVerificationCodeRequestDto')
          ..add('email', email)
          ..add('purpose', purpose))
        .toString();
  }
}

class SendVerificationCodeRequestDtoBuilder
    implements
        Builder<
          SendVerificationCodeRequestDto,
          SendVerificationCodeRequestDtoBuilder
        > {
  _$SendVerificationCodeRequestDto? _$v;

  String? _email;
  String? get email => _$this._email;
  set email(String? email) => _$this._email = email;

  SendVerificationCodeRequestDtoPurposeEnum? _purpose;
  SendVerificationCodeRequestDtoPurposeEnum? get purpose => _$this._purpose;
  set purpose(SendVerificationCodeRequestDtoPurposeEnum? purpose) =>
      _$this._purpose = purpose;

  SendVerificationCodeRequestDtoBuilder() {
    SendVerificationCodeRequestDto._defaults(this);
  }

  SendVerificationCodeRequestDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _email = $v.email;
      _purpose = $v.purpose;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(SendVerificationCodeRequestDto other) {
    _$v = other as _$SendVerificationCodeRequestDto;
  }

  @override
  void update(void Function(SendVerificationCodeRequestDtoBuilder)? updates) {
    if (updates != null) updates(this);
  }

  @override
  SendVerificationCodeRequestDto build() => _build();

  _$SendVerificationCodeRequestDto _build() {
    final _$result =
        _$v ??
        _$SendVerificationCodeRequestDto._(
          email: BuiltValueNullFieldError.checkNotNull(
            email,
            r'SendVerificationCodeRequestDto',
            'email',
          ),
          purpose: BuiltValueNullFieldError.checkNotNull(
            purpose,
            r'SendVerificationCodeRequestDto',
            'purpose',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
