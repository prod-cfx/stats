//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/whale_notification_channels_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'whale_notification_rule_response_dto.g.dart';

/// WhaleNotificationRuleResponseDto
///
/// Properties:
/// * [id] - 通知规则 ID
/// * [type] - 规则类型
/// * [address] 
/// * [symbol] 
/// * [thresholdUsd] 
/// * [note] 
/// * [channels] 
/// * [isActive] - 规则是否启用
/// * [createdAt] - 创建时间（ISO 8601）
/// * [updatedAt] - 更新时间（ISO 8601）
@BuiltValue()
abstract class WhaleNotificationRuleResponseDto implements Built<WhaleNotificationRuleResponseDto, WhaleNotificationRuleResponseDtoBuilder> {
  /// 通知规则 ID
  @BuiltValueField(wireName: r'id')
  String get id;

  /// 规则类型
  @BuiltValueField(wireName: r'type')
  WhaleNotificationRuleResponseDtoTypeEnum get type;
  // enum typeEnum {  ADDRESS,  SYMBOL,  };

  @BuiltValueField(wireName: r'address')
  String? get address;

  @BuiltValueField(wireName: r'symbol')
  String? get symbol;

  @BuiltValueField(wireName: r'thresholdUsd')
  num get thresholdUsd;

  @BuiltValueField(wireName: r'note')
  String? get note;

  @BuiltValueField(wireName: r'channels')
  WhaleNotificationChannelsDto get channels;

  /// 规则是否启用
  @BuiltValueField(wireName: r'isActive')
  bool get isActive;

  /// 创建时间（ISO 8601）
  @BuiltValueField(wireName: r'createdAt')
  String get createdAt;

  /// 更新时间（ISO 8601）
  @BuiltValueField(wireName: r'updatedAt')
  String get updatedAt;

  WhaleNotificationRuleResponseDto._();

  factory WhaleNotificationRuleResponseDto([void updates(WhaleNotificationRuleResponseDtoBuilder b)]) = _$WhaleNotificationRuleResponseDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(WhaleNotificationRuleResponseDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<WhaleNotificationRuleResponseDto> get serializer => _$WhaleNotificationRuleResponseDtoSerializer();
}

class _$WhaleNotificationRuleResponseDtoSerializer implements PrimitiveSerializer<WhaleNotificationRuleResponseDto> {
  @override
  final Iterable<Type> types = const [WhaleNotificationRuleResponseDto, _$WhaleNotificationRuleResponseDto];

  @override
  final String wireName = r'WhaleNotificationRuleResponseDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    WhaleNotificationRuleResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'id';
    yield serializers.serialize(
      object.id,
      specifiedType: const FullType(String),
    );
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(WhaleNotificationRuleResponseDtoTypeEnum),
    );
    if (object.address != null) {
      yield r'address';
      yield serializers.serialize(
        object.address,
        specifiedType: const FullType(String),
      );
    }
    if (object.symbol != null) {
      yield r'symbol';
      yield serializers.serialize(
        object.symbol,
        specifiedType: const FullType(String),
      );
    }
    yield r'thresholdUsd';
    yield serializers.serialize(
      object.thresholdUsd,
      specifiedType: const FullType(num),
    );
    if (object.note != null) {
      yield r'note';
      yield serializers.serialize(
        object.note,
        specifiedType: const FullType(String),
      );
    }
    yield r'channels';
    yield serializers.serialize(
      object.channels,
      specifiedType: const FullType(WhaleNotificationChannelsDto),
    );
    yield r'isActive';
    yield serializers.serialize(
      object.isActive,
      specifiedType: const FullType(bool),
    );
    yield r'createdAt';
    yield serializers.serialize(
      object.createdAt,
      specifiedType: const FullType(String),
    );
    yield r'updatedAt';
    yield serializers.serialize(
      object.updatedAt,
      specifiedType: const FullType(String),
    );
  }

  @override
  Object serialize(
    Serializers serializers,
    WhaleNotificationRuleResponseDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required WhaleNotificationRuleResponseDtoBuilder result,
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
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleNotificationRuleResponseDtoTypeEnum),
          ) as WhaleNotificationRuleResponseDtoTypeEnum;
          result.type = valueDes;
          break;
        case r'address':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.address = valueDes;
          break;
        case r'symbol':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.symbol = valueDes;
          break;
        case r'thresholdUsd':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(num),
          ) as num;
          result.thresholdUsd = valueDes;
          break;
        case r'note':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.note = valueDes;
          break;
        case r'channels':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(WhaleNotificationChannelsDto),
          ) as WhaleNotificationChannelsDto;
          result.channels.replace(valueDes);
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
            specifiedType: const FullType(String),
          ) as String;
          result.createdAt = valueDes;
          break;
        case r'updatedAt':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.updatedAt = valueDes;
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  WhaleNotificationRuleResponseDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = WhaleNotificationRuleResponseDtoBuilder();
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

class WhaleNotificationRuleResponseDtoTypeEnum extends EnumClass {

  /// 规则类型
  @BuiltValueEnumConst(wireName: r'ADDRESS')
  static const WhaleNotificationRuleResponseDtoTypeEnum ADDRESS = _$whaleNotificationRuleResponseDtoTypeEnum_ADDRESS;
  /// 规则类型
  @BuiltValueEnumConst(wireName: r'SYMBOL')
  static const WhaleNotificationRuleResponseDtoTypeEnum SYMBOL = _$whaleNotificationRuleResponseDtoTypeEnum_SYMBOL;

  static Serializer<WhaleNotificationRuleResponseDtoTypeEnum> get serializer => _$whaleNotificationRuleResponseDtoTypeEnumSerializer;

  const WhaleNotificationRuleResponseDtoTypeEnum._(String name): super(name);

  static BuiltSet<WhaleNotificationRuleResponseDtoTypeEnum> get values => _$whaleNotificationRuleResponseDtoTypeEnumValues;
  static WhaleNotificationRuleResponseDtoTypeEnum valueOf(String name) => _$whaleNotificationRuleResponseDtoTypeEnumValueOf(name);
}

