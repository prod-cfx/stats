import '../../data/services/api_client.dart';

String formatAiErrorText(Object error) {
  if (error is ApiException) return error.message;
  if (error is FormatException) return error.message;
  return error.toString();
}
