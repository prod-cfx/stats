//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'dart:core';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';
import 'package:one_of/one_of.dart';

part 'create_setting_dto_value.g.dart';

/// 配置值（可以是字符串、数字、布尔值或JSON对象）
@BuiltValue()
abstract class CreateSettingDtoValue implements Built<CreateSettingDtoValue, CreateSettingDtoValueBuilder> {
  /// One Of [BuiltList<String>], [JsonObject], [String], [bool], [num]
  OneOf get oneOf;

  CreateSettingDtoValue._();

  factory CreateSettingDtoValue([void updates(CreateSettingDtoValueBuilder b)]) = _$CreateSettingDtoValue;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(CreateSettingDtoValueBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<CreateSettingDtoValue> get serializer => _$CreateSettingDtoValueSerializer();
}

class _$CreateSettingDtoValueSerializer implements PrimitiveSerializer<CreateSettingDtoValue> {
  @override
  final Iterable<Type> types = const [CreateSettingDtoValue, _$CreateSettingDtoValue];

  @override
  final String wireName = r'CreateSettingDtoValue';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    CreateSettingDtoValue object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
  }

  @override
  Object serialize(
    Serializers serializers,
    CreateSettingDtoValue object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final oneOf = object.oneOf;
    return serializers.serialize(oneOf.value, specifiedType: FullType(oneOf.valueType))!;
  }

  @override
  CreateSettingDtoValue deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = CreateSettingDtoValueBuilder();
    Object? oneOfDataSrc;
    final targetType = const FullType(OneOf, [FullType(String), FullType(num), FullType(bool), FullType(JsonObject), FullType(BuiltList, [FullType(String)]), ]);
    oneOfDataSrc = serialized;
    result.oneOf = serializers.deserialize(oneOfDataSrc, specifiedType: targetType) as OneOf;
    return result.build();
  }
}

