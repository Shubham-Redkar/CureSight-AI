import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:mobile/core/errors/api_error_handler.dart';

void main() {
  group('ApiErrorHandler Tests', () {
    test('handles 401 Unauthorized', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 401,
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "Your session has expired. Please log in again.");
    });

    test('handles 403 Forbidden', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 403,
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "Your session has expired. Please log in again.");
    });

    test('handles 404 Not Found', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 404,
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "The requested resource was not found.");
    });

    test('handles 422 with backend message', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 422,
          data: {'message': 'Custom validation error'},
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "Custom validation error");
    });

    test('handles 429 Too Many Requests', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 429,
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "Too many requests. Please try again later.");
    });

    test('handles 500 Server Error', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 500,
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "The server encountered an error (500). Please try again later.");
    });

    test('handles Connection Timeout', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.connectionTimeout,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "The connection timed out. Please check your internet and try again.");
    });

    test('handles Connection Error', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        type: DioExceptionType.connectionError,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "Unable to reach the server. Please check your internet connection.");
    });

    test('handles Unknown Exception', () {
      final message = ApiErrorHandler.getMessage(Exception("Some random error"));
      expect(message, "Something went wrong. Please try again.");
    });

    test('handles 422 NO_WOUND_DETECTED', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 422,
          data: {
            'status': 'error',
            'error': 'NO_WOUND_DETECTED',
            'message': 'YOLO did not detect any wounds.',
          },
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "No wound was detected in this image. Please upload a clear photo that clearly shows the wound.");
    });

    test('handles 422 IMAGE_QUALITY_FAILED', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 422,
          data: {
            'status': 'error',
            'error': 'IMAGE_QUALITY_FAILED',
            'message': 'Image failed quality checks: Image appears too blurry (sharpness=4.7, minimum 5.0)'
          },
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "The image quality is too low for analysis. Please retake the photo with better focus and lighting.");
    });

    test('handles 503 MODELS_NOT_LOADED', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 503,
          data: {
            'status': 'error',
            'error': 'MODELS_NOT_LOADED',
          },
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "The wound analysis service is currently unavailable. Please try again in a moment.");
    });

    test('handles 500 with nested FastAPI error NO_WOUND_DETECTED', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 500,
          data: {
            'status': 'error',
            'error': 'AI_ANALYSIS_FAILED',
            'message': 'FastAPI error: 422 {"error":{"code":"NO_WOUND_DETECTED","message":"YOLO did not detect any wounds.","details":[],"request_id":"..."}}'
          },
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "No wound was detected in this image. Please upload a clear photo that clearly shows the wound.");
    });

    test('handles 413 Image Too Large', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/'),
        response: Response(
          requestOptions: RequestOptions(path: '/'),
          statusCode: 413,
        ),
        type: DioExceptionType.badResponse,
      );
      final message = ApiErrorHandler.getMessage(dioException);
      expect(message, "This image is too large to analyze. Please choose a smaller image.");
    });
  });
}
