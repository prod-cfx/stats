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

part 'update_setting_dto_value.g.dart';

/// 配置值（可以是字符串、数字、布尔值或JSON对象）
@BuiltValue()
abstract class UpdateSettingDtoValue implements Built<UpdateSettingDtoValue, UpdateSettingDtoValueBuilder> {
  /// One Of [BuiltList<String>], [JsonObject], [String], [bool], [num]
  OneOf get oneOf;

  UpdateSettingDtoValue._();

  factory UpdateSettingDtoValue([void updates(UpdateSettingDtoValueBuilder b)]) = _$UpdateSettingDtoValue;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(UpdateSettingDtoValueBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<UpdateSettingDtoValue> get serializer => _$UpdateSettingDtoValueSerializer();
}

class _$UpdateSettingDtoValueSerializer implements PrimitiveSerializer<UpdateSettingDtoValue> {
  @override
  final Iterable<Type> types = const [UpdateSettingDtoValue, _$UpdateSettingDtoValue];

  @override
  final String wireName = r'UpdateSettingDtoValue';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    UpdateSettingDtoValue object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
  }

  @override
  Object serialize(
    Serializers serializers,
    UpdateSettingDtoValue object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final oneOf = object.oneOf;
    return serializers.serialize(oneOf.value, specifiedType: FullType(oneOf.valueType))!;
  }

  @override
  UpdateSettingDtoValue deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = UpdateSettingDtoValueBuilder();
    Object? oneOfDataSrc;
    final targetType = const FullType(OneOf, [FullType(String), FullType(num), FullType(bool), FullType(JsonObject), FullType(BuiltList, [FullType(String)]), ]);
    oneOfDataSrc = serialized;
    result.oneOf = serializers.deserialize(oneOfDataSrc, specifiedType: targetType) as OneOf;
    return result.build();
  }
}

