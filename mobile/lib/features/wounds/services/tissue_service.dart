import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/network/dio_client.dart';
import '../../../core/errors/api_error_handler.dart';
import '../models/tissue_model.dart';

class TissueService {
  Future<AnalyzeTissueResponse> analyzeTissue(File imageFile) async {
    try {
      final dio = await DioClient.getInstance();
      
      String fileName = imageFile.path.split('/').last;
      FormData formData = FormData.fromMap({
        "image": await MultipartFile.fromFile(imageFile.path, filename: fileName),
      });

      final response = await dio.post('/analysis/tissue', data: formData);

      if (response.statusCode == 200 && response.data['status'] == 'ok') {
        return AnalyzeTissueResponse.fromJson(response.data);
      } else {
        throw Exception(response.data['message'] ?? 'Failed to analyze tissue');
      }
    } on DioException catch (e) {
      if (e.response != null && e.response?.data != null) {
         final data = e.response?.data;
         final msg = data['message'] ?? data['error'] ?? 'Analysis failed';
         throw Exception(msg);
      }
      throw Exception(ApiErrorHandler.getMessage(e));
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }
}
