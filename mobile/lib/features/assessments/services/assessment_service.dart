import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/errors/api_error_handler.dart';
import '../models/assessment_model.dart';

class AssessmentService {
  Future<List<AssessmentModel>> getAssessments(int woundId) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get(
        '/assessments',
        queryParameters: {'woundId': woundId},
      );
      final List<dynamic> data = response.data['assessments'];
      return data.map((json) => AssessmentModel.fromJson(json)).toList();
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }

  Future<AssessmentModel> uploadWoundImage(int woundId, File imageFile) async {
    try {
      final fileName = imageFile.path.split('/').last;
      
      final formData = FormData.fromMap({
        'woundId': woundId.toString(),
        'image': await MultipartFile.fromFile(
          imageFile.path,
          filename: fileName,
        ),
      });

      final dio = await DioClient.getInstance();
      final response = await dio.post(
        '/upload',
        data: formData,
        options: Options(
          sendTimeout: const Duration(minutes: 5),
          receiveTimeout: const Duration(minutes: 5),
        ),
      );

      final data = response.data;
      if (data['status'] == 'ok' && data['assessment'] != null) {
        return AssessmentModel.fromJson(data['assessment']);
      } else {
        throw Exception(data['message'] ?? 'Upload failed');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }

  Future<AssessmentModel> verifyAssessment(int id, Map<String, dynamic> verifiedResult) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.patch(
        '/assessments/$id/verify',
        data: {'verifiedResult': verifiedResult},
      );
      
      final data = response.data;
      if (data['status'] == 'ok' && data['assessment'] != null) {
        return AssessmentModel.fromJson(data['assessment']);
      } else {
        throw Exception(data['message'] ?? 'Verification failed');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }
}
