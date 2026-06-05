// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ai_quant_conversation_message_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const AiQuantConversationMessageResponseDtoRoleEnum
_$aiQuantConversationMessageResponseDtoRoleEnum_user =
    const AiQuantConversationMessageResponseDtoRoleEnum._('user');
const AiQuantConversationMessageResponseDtoRoleEnum
_$aiQuantConversationMessageResponseDtoRoleEnum_assistant =
    const AiQuantConversationMessageResponseDtoRoleEnum._('assistant');

AiQuantConversationMessageResponseDtoRoleEnum
_$aiQuantConversationMessageResponseDtoRoleEnumValueOf(String name) {
  switch (name) {
    case 'user':
      return _$aiQuantConversationMessageResponseDtoRoleEnum_user;
    case 'assistant':
      return _$aiQuantConversationMessageResponseDtoRoleEnum_assistant;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<AiQuantConversationMessageResponseDtoRoleEnum>
_$aiQuantConversationMessageResponseDtoRoleEnumValues =
    BuiltSet<AiQuantConversationMessageResponseDtoRoleEnum>(
      const <AiQuantConversationMessageResponseDtoRoleEnum>[
        _$aiQuantConversationMessageResponseDtoRoleEnum_user,
        _$aiQuantConversationMessageResponseDtoRoleEnum_assistant,
      ],
    );

Serializer<AiQuantConversationMessageResponseDtoRoleEnum>
_$aiQuantConversationMessageResponseDtoRoleEnumSerializer =
    _$AiQuantConversationMessageResponseDtoRoleEnumSerializer();

class _$AiQuantConversationMessageResponseDtoRoleEnumSerializer
    implements
        PrimitiveSerializer<AiQuantConversationMessageResponseDtoRoleEnum> {
  static const Map<String, Object> _toWire = const <String, Object>{
    'user': 'user',
    'assistant': 'assistant',
  };
  static const Map<Object, String> _fromWire = const <Object, String>{
    'user': 'user',
    'assistant': 'assistant',
  };

  @override
  final Iterable<Type> types = const <Type>[
    AiQuantConversationMessageResponseDtoRoleEnum,
  ];
  @override
  final String wireName = 'AiQuantConversationMessageResponseDtoRoleEnum';

  @override
  Object serialize(
    Serializers serializers,
    AiQuantConversationMessageResponseDtoRoleEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  AiQuantConversationMessageResponseDtoRoleEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => AiQuantConversationMessageResponseDtoRoleEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$AiQuantConversationMessageResponseDto
    extends AiQuantConversationMessageResponseDto {
  @override
  final AiQuantConversationMessageResponseDtoRoleEnum role;
  @override
  final String content;

  factory _$AiQuantConversationMessageResponseDto([
    void Function(AiQuantConversationMessageResponseDtoBuilder)? updates,
  ]) => (AiQuantConversationMessageResponseDtoBuilder()..update(updates))
      ._build();

  _$AiQuantConversationMessageResponseDto._({
    required this.role,
    required this.content,
  }) : super._();
  @override
  AiQuantConversationMessageResponseDto rebuild(
    void Function(AiQuantConversationMessageResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  AiQuantConversationMessageResponseDtoBuilder toBuilder() =>
      AiQuantConversationMessageResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is AiQuantConversationMessageResponseDto &&
        role == other.role &&
        content == other.content;
  }

  @override
  int get hashCode {
    var _$hash = 0;
    _$hash = $jc(_$hash, role.hashCode);
    _$hash = $jc(_$hash, content.hashCode);
    _$hash = $jf(_$hash);
    return _$hash;
  }

  @override
  String toString() {
    return (newBuiltValueToStringHelper(
            r'AiQuantConversationMessageResponseDto',
          )
          ..add('role', role)
          ..add('content', content))
        .toString();
  }
}

class AiQuantConversationMessageResponseDtoBuilder
    implements
        Builder<
          AiQuantConversationMessageResponseDto,
          AiQuantConversationMessageResponseDtoBuilder
        > {
  _$AiQuantConversationMessageResponseDto? _$v;

  AiQuantConversationMessageResponseDtoRoleEnum? _role;
  AiQuantConversationMessageResponseDtoRoleEnum? get role => _$this._role;
  set role(AiQuantConversationMessageResponseDtoRoleEnum? role) =>
      _$this._role = role;

  String? _content;
  String? get content => _$this._content;
  set content(String? content) => _$this._content = content;

  AiQuantConversationMessageResponseDtoBuilder() {
    AiQuantConversationMessageResponseDto._defaults(this);
  }

  AiQuantConversationMessageResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _role = $v.role;
      _content = $v.content;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(AiQuantConversationMessageResponseDto other) {
    _$v = other as _$AiQuantConversationMessageResponseDto;
  }

  @override
  void update(
    void Function(AiQuantConversationMessageResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  AiQuantConversationMessageResponseDto build() => _build();

  _$AiQuantConversationMessageResponseDto _build() {
    final _$result =
        _$v ??
        _$AiQuantConversationMessageResponseDto._(
          role: BuiltValueNullFieldError.checkNotNull(
            role,
            r'AiQuantConversationMessageResponseDto',
            'role',
          ),
          content: BuiltValueNullFieldError.checkNotNull(
            content,
            r'AiQuantConversationMessageResponseDto',
            'content',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
