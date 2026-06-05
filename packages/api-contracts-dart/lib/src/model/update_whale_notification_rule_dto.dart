//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/whale_notification_channels_dto.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'update_whale_notification_rule_dto.g.dart';

/// UpdateWhaleNotificationRuleDto
///
/// Properties:
/// * [thresholdUsd] 
/// * [note] 
/// * [channels] 
/// * [isActive] 
@BuiltValue()
abstract class UpdateWhaleNotificationRuleDto implements Built<UpdateWhaleNotificationRuleDto, UpdateWhaleNotificationRuleDtoBuilder> {
  @BuiltValueField(wireName: r'thresholdUsd')
  num? get thresholdUsd;

  @BuiltValueField(wireName: r'note')
  String? get note;

  @BuiltValueField(wireName: r'channels')
  WhaleNotificationChannelsDto? get channels;

  @BuiltValueField(wireName: r'isActive')
  bool? get isActive;

  UpdateWhaleNotificationRuleDto._();

  factory UpdateWhaleNotificationRuleDto([void updates(UpdateWhaleNotificationRuleDtoBuilder b)]) = _$UpdateWhaleNotificationRuleDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateWhaleNotificationRuleDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateWhaleNotificationRuleDto> get serializer => _$UpdateWhaleNotificationRuleDtoSerializer();
}

class _$UpdateWhaleNotificationRuleDtoSerializer implements PrimitiveSerializer<UpdateWhaleNotificationRuleDto> {
  @override
  final Iterable<Type> types = const [UpdateWhaleNotificationRuleDto, _$UpdateWhaleNotificationRuleDto];

  @override
  final String wireName = r'UpdateWhaleNotificationRuleDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateWhaleNotificationRuleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.thresholdUsd != null) {
      yield r'thresholdUsd';
      yield serializers.serialize(
        object.thresholdUsd,
        specifiedType: const FullType(num),
      );
    }
    if (object.note != null) {
      yield r'note';
      yield serializers.serialize(
        object.note,
        specifiedType: const FullType(String),
      );
    }
    if (object.channels != null) {
      yield r'channels';
      yield serializers.serialize(
        object.channels,
        specifiedType: const FullType(WhaleNotificationChannelsDto),
      );
    }
    if (object.isActive != null) {
      yield r'isActive';
      yield serializers.serialize(
        object.isActive,
        specifiedType: const FullType(bool),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateWhaleNotificationRuleDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required UpdateWhaleNotificationRuleDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
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
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  UpdateWhaleNotificationRuleDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateWhaleNotificationRuleDtoBuilder();
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

