import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme/app_theme.dart';
import 'core/router/app_router.dart';

import 'core/network/dio_client.dart';
import 'package:dio/dio.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // Diagnostic health check
  try {
    final dio = await DioClient.getInstance();
    print('DIAGNOSTIC: Attempting to connect to ${dio.options.baseUrl}/health');
    final response = await dio.get('/health');
    print('DIAGNOSTIC: Success! Status: ${response.statusCode}');
    print('DIAGNOSTIC: Body: ${response.data}');
  } on DioException catch (e) {
    print('DIAGNOSTIC: FAILURE! Type: ${e.type}');
    print('DIAGNOSTIC: Message: ${e.message}');
    print('DIAGNOSTIC: Underlying error: ${e.error}');
    print('DIAGNOSTIC: Response: ${e.response?.statusCode} ${e.response?.data}');
  } catch (e) {
    print('DIAGNOSTIC: Unknown error: $e');
  }

  runApp(
    const ProviderScope(
      child: MyApp(),
    ),
  );
}

class MyApp extends ConsumerWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'CureSight AI',
      theme: AppTheme.lightTheme,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
