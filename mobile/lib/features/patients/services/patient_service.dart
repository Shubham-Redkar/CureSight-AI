import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/errors/api_error_handler.dart';
import '../models/patient_model.dart';

class PatientService {
  Future<List<PatientModel>> getPatients() async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get('/patients');
      
      if (response.statusCode == 200 && response.data['status'] == 'ok') {
        final List<dynamic> data = response.data['patients'] ?? [];
        return data.map((json) => PatientModel.fromJson(json)).toList();
      } else {
        throw Exception('Failed to load patients');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }

  Future<PatientModel> createPatient(String patientCode, String name, int? age) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.post('/patients', data: {
        'patientCode': patientCode,
        'name': name,
        'age': age,
      });

      if (response.statusCode == 201 && response.data['status'] == 'ok') {
        return PatientModel.fromJson(response.data['patient']);
      } else {
        throw Exception('Failed to create patient');
      }
    } on DioException catch (e) {
      if (e.response?.statusCode == 400 || e.response?.statusCode == 409) {
        throw Exception(e.response?.data['message'] ?? 'Validation failed.');
      }
      throw Exception(ApiErrorHandler.getMessage(e));
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }
}
