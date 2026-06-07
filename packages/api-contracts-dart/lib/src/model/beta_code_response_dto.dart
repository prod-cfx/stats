//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'beta_code_response_dto.g.dart';

/// BetaCodeResponseDto
///
/// Properties:
/// * [id] - 内测码 ID
/// * [code] - 内测码
/// * [maxUses] - 最大可用次数
/// * [usedCount] - 已使用次数
/// * [isActive] - 是否启用
/// * [createdAt] - 创建时间
@BuiltValue()
abstract class BetaCodeResponseDto implements Built<BetaCodeResponseDto, BetaCodeResponseDtoBuilder> {
  /// 内测码 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 内测码
  @BuiltValueField(wireName: r'code')
  String get code;

  /// 最大可用次数
  @BuiltValueField(wireName: r'maxUses')
  num get maxUses;

  /// 已使用次数
  @BuiltValueField(wireName: r'usedCount')
  num get usedCount;

  /// 是否启用
  @BuiltValueField(wireName: r'isActive')
  bool get isActive;

  /// 创建时间
  @BuiltValueField(wireName: r'createdAt')
  DateTime get createdAt;

  BetaCodeResponseDto._();

  factory BetaCodeResponseDto([void updates(BetaCodeResponseDtoBuilder b)]) = _$BetaCodeResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BetaCodeResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BetaCodeResponseDto> get serializer => _$BetaCodeResponseDtoSerializer();
}

class _$BetaCodeResponseDtoSerializer implements PrimitiveSerializer<BetaCodeResponseDto> {
  @override
  final Iterable<Type> types = const [BetaCodeResponseDto, _$BetaCodeResponseDto];

  @override
  final String wireName = r'BetaCodeResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BetaCodeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'code';
    yield serializers.serialize(
      object.code,
      specifiedType: const FullType(String),
    );
    yield r'maxUses';
    yield serializers.serialize(
      object.maxUses,
      specifiedType: const FullType(num),
    );
    yield r'usedCount';
    yield serializers.serialize(
      object.usedCount,
      specifiedType: const FullType(num),
    );
    yield r'isActive';
    yield serializers.serialize(
      object.isActive,
      specifiedType: const FullType(bool),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(DateTime),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    BetaCodeResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BetaCodeResponseDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'id':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.id = valueDes;
          break;
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.code = valueDes;
          break;
        case r'maxUses':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.maxUses = valueDes;
          break;
        case r'usedCount':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.usedCount = valueDes;
          break;
        case r'isActive':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(bool),
          ) as bool;
          result.isActive = valueDes;
          break;
        case r'createdAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(DateTime),
          ) as DateTime;
          result.createdAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BetaCodeResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BetaCodeResponseDtoBuilder();
    final serializedList = (serialized as Iterable<Object?>).toList();
    final unhandled = <Object?>[];
    _deserializeProperties(
      serializers,
      serialized,
      specifiedType: specifiedType,
      serializedList: serializedList,
      unhandled: unhandled,
      result: result,
    );
    return result.build();
  }
}

