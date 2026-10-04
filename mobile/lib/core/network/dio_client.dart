import 'dart:io';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:path_provider/path_provider.dart';
import '../config/env_config.dart';

class DioClient {
  static Dio? _dio;
  static PersistCookieJar? _cookieJar;

  static void setMockDio(Dio mock) {
    _dio = mock;
  }

  static Future<Dio> getInstance() async {
    if (_dio != null) return _dio!;

    _dio = Dio(
      BaseOptions(
        baseUrl: EnvConfig.apiBaseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      ),
    );

    // Initialize Cookie Jar
    final Directory appDocDir = await getApplicationDocumentsDirectory();
    final String appDocPath = appDocDir.path;
    _cookieJar = PersistCookieJar(
      ignoreExpires: true,
      storage: FileStorage("$appDocPath/.cookies/"),
    );

    // Add Cookie Manager
    _dio!.interceptors.add(CookieManager(_cookieJar!));

    _dio!.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          print('===> [DIO REQUEST] ${options.method} ${options.uri}');
          print('===> [DIO BASE URL] ${options.baseUrl}');
          return handler.next(options);
        },
        onResponse: (response, handler) {
          print('<=== [DIO RESPONSE] ${response.statusCode} ${response.requestOptions.uri}');
          return handler.next(response);
        },
        onError: (DioException e, handler) {
          print('xxx> [DIO ERROR] type: ${e.type}, message: ${e.message}');
          print('xxx> [DIO ERROR URI] ${e.requestOptions.uri}');
          if (e.error != null) {
            print('xxx> [DIO UNDERLYING ERROR] ${e.error}');
          }
          if (e.response != null) {
            print('xxx> [DIO RESPONSE STATUS] ${e.response?.statusCode}');
          }
          return handler.next(e);
        },
      ),
    );

    return _dio!;
  }

  static Future<void> clearCookies() async {
    await _cookieJar?.deleteAll();
  }
}
