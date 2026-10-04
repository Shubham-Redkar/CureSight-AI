import 'dart:developer';
import 'package:dio/dio.dart';

class ApiErrorHandler {
  static String getMessage(dynamic error) {
    // Preserve original technical error for developer logging in logcat
    print('================ API ERROR DETAILS ================');
    print('Type: ${error.runtimeType}');
    if (error is DioException) {
      print('DioError Type: ${error.type}');
      print('DioError Message: ${error.message}');
      print('Underlying Error: ${error.error}');
      print('URI: ${error.requestOptions.uri}');
      print('Response Status: ${error.response?.statusCode}');
    } else {
      print('Error: $error');
    }
    print('===================================================');

    if (error is Exception) {
      try {
        if (error is DioException) {
          switch (error.type) {
            case DioExceptionType.connectionTimeout:
            case DioExceptionType.sendTimeout:
            case DioExceptionType.receiveTimeout:
              return "The connection timed out. Please check your internet and try again.";
            case DioExceptionType.connectionError:
              // DNS or network unavailable
              return "Unable to reach the server. Please check your internet connection.";
            case DioExceptionType.badCertificate:
              return "Security error: Unable to verify server certificate.";
            case DioExceptionType.badResponse:
              final statusCode = error.response?.statusCode;
              final responseData = error.response?.data;
              
              if (statusCode == 401 || statusCode == 403) {
                return "Your session has expired. Please log in again.";
              } else if (statusCode == 404) {
                return "The requested resource was not found.";
              } else if (statusCode == 413) {
                return "This image is too large to analyze. Please choose a smaller image.";
              } else if (statusCode == 422 || statusCode == 503) {
                if (responseData is Map<String, dynamic>) {
                  final String? errCode = responseData['error']?.toString();
                  if (errCode == 'NO_WOUND_DETECTED' || errCode == 'NON_WOUND_IMAGE') {
                    return "No wound was detected in this image. Please upload a clear photo that clearly shows the wound.";
                  } else if (errCode == 'IMAGE_QUALITY_FAILED') {
                    return "The image quality is too low for analysis. Please retake the photo with better focus and lighting.";
                  } else if (errCode == 'MODELS_NOT_LOADED') {
                    return "The wound analysis service is currently unavailable. Please try again in a moment.";
                  } else if (responseData['message'] != null) {
                    final msg = responseData['message'].toString();
                    if (msg.contains('FastAPI error:')) {
                      return _parseNestedFastApiError(msg);
                    }
                    return msg;
                  }
                }
                if (statusCode == 503) {
                   return "The service is temporarily unavailable. Please try again later.";
                }
                return "Validation failed. Please check your input.";
              } else if (statusCode == 429) {
                return "Too many requests. Please try again later.";
              } else if (statusCode != null && statusCode >= 500) {
                if (responseData is Map<String, dynamic> && responseData['message'] != null) {
                  final msg = responseData['message'].toString();
                  if (msg.contains('FastAPI error:')) {
                     return _parseNestedFastApiError(msg);
                  }
                }
                return "The server encountered an error ($statusCode). Please try again later.";
              }
              
              return "Server returned an error ($statusCode). Please try again.";
            case DioExceptionType.cancel:
              return "The request was cancelled.";
            case DioExceptionType.unknown:
            default:
              return "An unknown network error occurred. Please try again.";
          }
        }
      } catch (e) {
        print('Error parsing API error: $e');
        return "An unexpected error occurred while parsing the response.";
      }
    }
    return "Something went wrong. Please try again.";
  }

  static String _parseNestedFastApiError(String message) {
    try {
      final jsonStartIndex = message.indexOf('{');
      if (jsonStartIndex != -1) {
        final jsonStr = message.substring(jsonStartIndex);
        // We'll just do simple string matching to avoid bringing in 'dart:convert' here, or we can use regex.
        if (jsonStr.contains('"NO_WOUND_DETECTED"')) {
           return "No wound was detected in this image. Please upload a clear photo that clearly shows the wound.";
        } else if (jsonStr.contains('"IMAGE_QUALITY_FAILED"')) {
           return "The image quality is too low for analysis. Please retake the photo with better focus and lighting.";
        } else if (jsonStr.contains('"MODELS_NOT_LOADED"')) {
           return "The wound analysis service is currently unavailable. Please try again in a moment.";
        }
      }
    } catch (_) {}
    return "The analysis service is temporarily unavailable. Please try again later.";
  }
}
