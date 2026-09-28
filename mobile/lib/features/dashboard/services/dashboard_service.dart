import '../../../core/network/dio_client.dart';
import '../../../core/errors/api_error_handler.dart';
import '../models/dashboard_summary_model.dart';

class DashboardService {
  Future<DashboardSummaryModel> getSummary() async {
    try {
      final dio = await DioClient.getInstance();
      final response = await dio.get('/dashboard/summary');

      if (response.statusCode == 200 && response.data['status'] == 'ok') {
        return DashboardSummaryModel.fromJson(response.data['data']);
      } else {
        throw Exception('Failed to load dashboard summary');
      }
    } catch (e) {
      throw Exception(ApiErrorHandler.getMessage(e));
    }
  }
}
