import '../../../core/network/dio_client.dart';
import '../../../core/errors/api_error_handler.dart';
import '../models/report_model.dart';
import '../models/report_list_model.dart';

class ReportService {
  Future<ClinicalReportModel> getClinicalReport(int assessmentId) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get('/reports/$assessmentId');
      
      final data = response.data;
      if (data['status'] == 'ok' && data['report'] != null) {
        return ClinicalReportModel.fromJson(data['report']);
      } else {
        throw Exception(data['message'] ?? 'Failed to load clinical report');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }

  Future<List<ReportListItemModel>> getReports({int page = 1, int limit = 20}) async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get('/reports', queryParameters: {
        'page': page,
        'limit': limit,
      });
      
      final data = response.data;
      if (data['status'] == 'ok') {
        return ReportListResponse.fromJson(data).reports;
      } else {
        throw Exception(data['error'] ?? 'Failed to load reports');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }
}
