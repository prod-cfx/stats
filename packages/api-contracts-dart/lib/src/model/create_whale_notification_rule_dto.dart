//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/whale_notification_channels_dto.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'create_whale_notification_rule_dto.g.dart';

/// CreateWhaleNotificationRuleDto
///
/// Properties:
/// * [type] 
/// * [address] 
/// * [symbol] 
/// * [thresholdUsd] 
/// * [note] 
/// * [channels] 
@BuiltValue()
abstract class CreateWhaleNotificationRuleDto implements Built<CreateWhaleNotificationRuleDto, CreateWhaleNotificationRuleDtoBuilder> {
  @BuiltValueField(wireName: r'type')
  CreateWhaleNotificationRuleDtoTypeEnum get type;
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

  CreateWhaleNotificationRuleDto._();

  factory CreateWhaleNotificationRuleDto([void updates(CreateWhaleNotificationRuleDtoBuilder b)]) = _$CreateWhaleNotificationRuleDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateWhaleNotificationRuleDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateWhaleNotificationRuleDto> get serializer => _$CreateWhaleNotificationRuleDtoSerializer();
}

class _$CreateWhaleNotificationRuleDtoSerializer implements PrimitiveSerializer<CreateWhaleNotificationRuleDto> {
  @override
  final Iterable<Type> types = const [CreateWhaleNotificationRuleDto, _$CreateWhaleNotificationRuleDto];

  @override
  final String wireName = r'CreateWhaleNotificationRuleDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateWhaleNotificationRuleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    yield r'type';
    yield serializers.serialize(
      object.type,
      specifiedType: const FullType(CreateWhaleNotificationRuleDtoTypeEnum),
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
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateWhaleNotificationRuleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required CreateWhaleNotificationRuleDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'type':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(CreateWhaleNotificationRuleDtoTypeEnum),
          ) as CreateWhaleNotificationRuleDtoTypeEnum;
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  CreateWhaleNotificationRuleDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateWhaleNotificationRuleDtoBuilder();
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

class CreateWhaleNotificationRuleDtoTypeEnum extends EnumClass {

  @BuiltValueEnumConst(wireName: r'ADDRESS')
  static const CreateWhaleNotificationRuleDtoTypeEnum ADDRESS = _$createWhaleNotificationRuleDtoTypeEnum_ADDRESS;
  @BuiltValueEnumConst(wireName: r'SYMBOL')
  static const CreateWhaleNotificationRuleDtoTypeEnum SYMBOL = _$createWhaleNotificationRuleDtoTypeEnum_SYMBOL;

  static Serializer<CreateWhaleNotificationRuleDtoTypeEnum> get serializer => _$createWhaleNotificationRuleDtoTypeEnumSerializer;

  const CreateWhaleNotificationRuleDtoTypeEnum._(String name): super(name);

  static BuiltSet<CreateWhaleNotificationRuleDtoTypeEnum> get values => _$createWhaleNotificationRuleDtoTypeEnumValues;
  static CreateWhaleNotificationRuleDtoTypeEnum valueOf(String name) => _$createWhaleNotificationRuleDtoTypeEnumValueOf(name);
}

