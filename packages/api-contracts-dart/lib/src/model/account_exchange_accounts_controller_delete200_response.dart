//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

// ignore_for_file: unused_element
import 'package:backend_api_contracts/src/model/admin_settings_controller_reload_settings200_response_data.dart';
import 'package:built_value/built_value.dart';
import 'package:built_value/serializer.dart';

part 'account_exchange_accounts_controller_delete200_response.g.dart';

/// AccountExchangeAccountsControllerDelete200Response
///
/// Properties:
/// * [data] 
@BuiltValue()
abstract class AccountExchangeAccountsControllerDelete200Response implements Built<AccountExchangeAccountsControllerDelete200Response, AccountExchangeAccountsControllerDelete200ResponseBuilder> {
  @BuiltValueField(wireName: r'data')
  AdminSettingsControllerReloadSettings200ResponseData? get data;

  AccountExchangeAccountsControllerDelete200Response._();

  factory AccountExchangeAccountsControllerDelete200Response([void updates(AccountExchangeAccountsControllerDelete200ResponseBuilder b)]) = _$AccountExchangeAccountsControllerDelete200Response;

  @BuiltValueHook(initializeBuilder: true)
  static void _defaults(AccountExchangeAccountsControllerDelete200ResponseBuilder b) => b;

  @BuiltValueSerializer(custom: true)
  static Serializer<AccountExchangeAccountsControllerDelete200Response> get serializer => _$AccountExchangeAccountsControllerDelete200ResponseSerializer();
}

class _$AccountExchangeAccountsControllerDelete200ResponseSerializer implements PrimitiveSerializer<AccountExchangeAccountsControllerDelete200Response> {
  @override
  final Iterable<Type> types = const [AccountExchangeAccountsControllerDelete200Response, _$AccountExchangeAccountsControllerDelete200Response];

  @override
  final String wireName = r'AccountExchangeAccountsControllerDelete200Response';

  Iterable<Object?> _serializeProperties(
    Serializers serializers,
    AccountExchangeAccountsControllerDelete200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) sync* {
    if (object.data != null) {
      yield r'data';
      yield serializers.serialize(
        object.data,
        specifiedType: const FullType(AdminSettingsControllerReloadSettings200ResponseData),
      );
    }
  }

  @override
  Object serialize(
    Serializers serializers,
    AccountExchangeAccountsControllerDelete200Response object, {
    FullType specifiedType = FullType.unspecified,
  }) {
    return _serializeProperties(serializers, object, specifiedType: specifiedType).toList();
  }

  void _deserializeProperties(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
    required List<Object?> serializedList,
    required AccountExchangeAccountsControllerDelete200ResponseBuilder result,
    required List<Object?> unhandled,
  }) {
    for (var i = 0; i < serializedList.length; i += 2) {
      final key = serializedList[i] as String;
      final value = serializedList[i + 1];
      switch (key) {
        case r'data':
          final valueDes = serializers.deserialize(
            value,
            specifiedType: const FullType(AdminSettingsControllerReloadSettings200ResponseData),
          ) as AdminSettingsControllerReloadSettings200ResponseData;
          result.data.replace(valueDes);
          break;
        default:
          unhandled.add(key);
          unhandled.add(value);
          break;
      }
    }
  }

  @override
  AccountExchangeAccountsControllerDelete200Response deserialize(
    Serializers serializers,
    Object serialized, {
    FullType specifiedType = FullType.unspecified,
  }) {
    final result = AccountExchangeAccountsControllerDelete200ResponseBuilder();
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

