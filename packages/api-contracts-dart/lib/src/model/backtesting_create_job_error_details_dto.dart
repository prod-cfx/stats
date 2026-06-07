//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'backtesting_create_job_error_details_dto.g.dart';

/// BacktestingCreateJobErrorDetailsDto
///
/// Properties:
/// * [code] 
/// * [message] - 错误信息
/// * [args] 
@BuiltValue()
abstract class BacktestingCreateJobErrorDetailsDto implements Built<BacktestingCreateJobErrorDetailsDto, BacktestingCreateJobErrorDetailsDtoBuilder> {
  @BuiltValueField(wireName: r'code')
  String? get code;

  /// 错误信息
  @BuiltValueField(wireName: r'message')
  String get message;

  @BuiltValueField(wireName: r'args')
  BuiltMap<String, JsonObject?>? get args;

  BacktestingCreateJobErrorDetailsDto._();

  factory BacktestingCreateJobErrorDetailsDto([void updates(BacktestingCreateJobErrorDetailsDtoBuilder b)]) = _$BacktestingCreateJobErrorDetailsDto;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(BacktestingCreateJobErrorDetailsDtoBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<BacktestingCreateJobErrorDetailsDto> get serializer => _$BacktestingCreateJobErrorDetailsDtoSerializer();
}

class _$BacktestingCreateJobErrorDetailsDtoSerializer implements PrimitiveSerializer<BacktestingCreateJobErrorDetailsDto> {
  @override
  final Iterable<Type> types = const [BacktestingCreateJobErrorDetailsDto, _$BacktestingCreateJobErrorDetailsDto];

  @override
  final String wireName = r'BacktestingCreateJobErrorDetailsDto';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    BacktestingCreateJobErrorDetailsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.code != null) {
      yield r'code';
      yield serializers.serialize(
        object.code,
        specifiedType: const FullType(String),
      );
    }
    yield r'message';
    yield serializers.serialize(
      object.message,
      specifiedType: const FullType(String),
    );
    if (object.args != null) {
      yield r'args';
      yield serializers.serialize(
        object.args,
        specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    BacktestingCreateJobErrorDetailsDto object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required BacktestingCreateJobErrorDetailsDtoBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'code':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.code = valueDes;
          break;
        case r'message':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(String),
          ) as String;
          result.message = valueDes;
          break;
        case r'args':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(BuiltMap, [FullType(String), FullType.nullable(JsonObject)]),
          ) as BuiltMap<String, JsonObject?>;
          result.args.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  BacktestingCreateJobErrorDetailsDto deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = BacktestingCreateJobErrorDetailsDtoBuilder();
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

