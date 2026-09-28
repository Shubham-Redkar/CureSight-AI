import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/report_model.dart';
import '../models/report_list_model.dart';
import '../services/report_service.dart';

final reportServiceProvider = Provider<ReportService>((ref) {
  return ReportService();
});

final clinicalReportProvider = FutureProvider.family<ClinicalReportModel, int>((ref, assessmentId) async {
  final service = ref.read(reportServiceProvider);
  return await service.getClinicalReport(assessmentId);
});

final reportListProvider = FutureProvider<List<ReportListItemModel>>((ref) async {
  final service = ref.read(reportServiceProvider);
  return await service.getReports();
});
