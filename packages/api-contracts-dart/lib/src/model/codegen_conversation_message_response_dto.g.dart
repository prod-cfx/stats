// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'codegen_conversation_message_response_dto.dart';

// **************************************************************************
// BuiltValueGenerator
// **************************************************************************

const CodegenConversationMessageResponseDtoRoleEnum
_$codegenConversationMessageResponseDtoRoleEnum_user =
    const CodegenConversationMessageResponseDtoRoleEnum._('user');
const CodegenConversationMessageResponseDtoRoleEnum
_$codegenConversationMessageResponseDtoRoleEnum_assistant =
    const CodegenConversationMessageResponseDtoRoleEnum._('assistant');

CodegenConversationMessageResponseDtoRoleEnum
_$codegenConversationMessageResponseDtoRoleEnumValueOf(String name) {
  switch (name) {
    case 'user':
      return _$codegenConversationMessageResponseDtoRoleEnum_user;
    case 'assistant':
      return _$codegenConversationMessageResponseDtoRoleEnum_assistant;
    default:
      throw ArgumentError(name);
  }
}

final BuiltSet<CodegenConversationMessageResponseDtoRoleEnum>
_$codegenConversationMessageResponseDtoRoleEnumValues =
    BuiltSet<CodegenConversationMessageResponseDtoRoleEnum>(
      const <CodegenConversationMessageResponseDtoRoleEnum>[
        _$codegenConversationMessageResponseDtoRoleEnum_user,
        _$codegenConversationMessageResponseDtoRoleEnum_assistant,
      ],
    );

Serializer<CodegenConversationMessageResponseDtoRoleEnum>
_$codegenConversationMessageResponseDtoRoleEnumSerializer =
    _$CodegenConversationMessageResponseDtoRoleEnumSerializer();

class _$CodegenConversationMessageResponseDtoRoleEnumSerializer
    implements
        PrimitiveSerializer<CodegenConversationMessageResponseDtoRoleEnum> {
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
    CodegenConversationMessageResponseDtoRoleEnum,
  ];
  @override
  final String wireName = 'CodegenConversationMessageResponseDtoRoleEnum';

  @override
  Object serialize(
    Serializers serializers,
    CodegenConversationMessageResponseDtoRoleEnum object, {
    FullType specifiedType = FullType.unspecified,
  }) => _toWire[object.name] ?? object.name;

  @override
  CodegenConversationMessageResponseDtoRoleEnum deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) => CodegenConversationMessageResponseDtoRoleEnum.valueOf(
    _fromWire[serialized] ?? (serialized is String ? serialized : ''),
  );
}

class _$CodegenConversationMessageResponseDto
    extends CodegenConversationMessageResponseDto {
  @override
  final CodegenConversationMessageResponseDtoRoleEnum role;
  @override
  final String content;

  factory _$CodegenConversationMessageResponseDto([
    void Function(CodegenConversationMessageResponseDtoBuilder)? updates,
  ]) => (CodegenConversationMessageResponseDtoBuilder()..update(updates))
      ._build();

  _$CodegenConversationMessageResponseDto._({
    required this.role,
    required this.content,
  }) : super._();
  @override
  CodegenConversationMessageResponseDto rebuild(
    void Function(CodegenConversationMessageResponseDtoBuilder) updates,
  ) => (toBuilder()..update(updates)).build();

  @override
  CodegenConversationMessageResponseDtoBuilder toBuilder() =>
      CodegenConversationMessageResponseDtoBuilder()..replace(this);

  @override
  bool operator ==(Object other) {
    if (identical(other, this)) return true;
    return other is CodegenConversationMessageResponseDto &&
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
            r'CodegenConversationMessageResponseDto',
          )
          ..add('role', role)
          ..add('content', content))
        .toString();
  }
}

class CodegenConversationMessageResponseDtoBuilder
    implements
        Builder<
          CodegenConversationMessageResponseDto,
          CodegenConversationMessageResponseDtoBuilder
        > {
  _$CodegenConversationMessageResponseDto? _$v;

  CodegenConversationMessageResponseDtoRoleEnum? _role;
  CodegenConversationMessageResponseDtoRoleEnum? get role => _$this._role;
  set role(CodegenConversationMessageResponseDtoRoleEnum? role) =>
      _$this._role = role;

  String? _content;
  String? get content => _$this._content;
  set content(String? content) => _$this._content = content;

  CodegenConversationMessageResponseDtoBuilder() {
    CodegenConversationMessageResponseDto._defaults(this);
  }

  CodegenConversationMessageResponseDtoBuilder get _$this {
    final $v = _$v;
    if ($v != null) {
      _role = $v.role;
      _content = $v.content;
      _$v = null;
    }
    return this;
  }

  @override
  void replace(CodegenConversationMessageResponseDto other) {
    _$v = other as _$CodegenConversationMessageResponseDto;
  }

  @override
  void update(
    void Function(CodegenConversationMessageResponseDtoBuilder)? updates,
  ) {
    if (updates != null) updates(this);
  }

  @override
  CodegenConversationMessageResponseDto build() => _build();

  _$CodegenConversationMessageResponseDto _build() {
    final _$result =
        _$v ??
        _$CodegenConversationMessageResponseDto._(
          role: BuiltValueNullFieldError.checkNotNull(
            role,
            r'CodegenConversationMessageResponseDto',
            'role',
          ),
          content: BuiltValueNullFieldError.checkNotNull(
            content,
            r'CodegenConversationMessageResponseDto',
            'content',
          ),
        );
    replace(_$result);
    return _$result;
  }
}

// ignore_for_file: deprecated_member_use_from_same_package,type=lint
