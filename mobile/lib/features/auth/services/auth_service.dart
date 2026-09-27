import '../../../core/network/dio_client.dart';
import '../../../models/user_model.dart';
import '../../../core/errors/api_error_handler.dart';

class AuthService {
  Future<UserModel> login(String username, String password) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.post('/auth/login', data: {
        'username': username,
        'password': password,
      });

      if (response.statusCode == 200 && response.data['user'] != null) {
        return UserModel.fromJson(response.data['user']);
      } else {
        throw Exception('Login failed');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }

  Future<UserModel> checkAuth() async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get('/auth/me');

      if (response.statusCode == 200 && response.data['authenticated'] == true) {
        return UserModel.fromJson(response.data['user']);
      } else {
        throw Exception('Unauthenticated');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }

  Future<void> logout() async {
    try {
      final dio = await DioClient.getInstance();
      await dio.post('/auth/logout');
      await DioClient.clearCookies();
    } catch (_) {
      // Ignore errors on logout, just clear local state
      await DioClient.clearCookies();
    }
  }
}
