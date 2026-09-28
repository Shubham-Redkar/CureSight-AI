import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/errors/api_error_handler.dart';
import '../models/wound_model.dart';

class WoundService {
  Future<List<WoundModel>> getWounds(int patientId) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get('/wounds', queryParameters: {'patientId': patientId});
      
      if (response.statusCode == 200 && response.data['status'] == 'ok') {
        final List<dynamic> data = response.data['wounds'] ?? [];
        return data.map((json) => WoundModel.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load wounds');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }

  Future<WoundModel> createWound(int patientId, String location, String? description) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.post('/wounds', data: {
        'patientId': patientId,
        'location': location,
        'description': description,
      });

      if (response.statusCode == 201 && response.data['status'] == 'ok') {
        return WoundModel.fromJson(response.data['wound']);
      } else {
        throw Exception('Failed to create wound');
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 400 || e.response?.statusCode == 404) {
        throw Exception(e.response?.data['message'] ?? 'Validation failed.');
      }
      throw Exception(ApiErrorHandler.getMessage(e));
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }
}
