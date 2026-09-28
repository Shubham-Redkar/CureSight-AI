import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/report_provider.dart';
import '../models/report_model.dart';

class ReportsScreen extends ConsumerWidget {
  final int assessmentId;

  const ReportsScreen({super.key, required this.assessmentId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final reportState = ref.watch(clinicalReportProvider(assessmentId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Clinical Report'),
      ),
      body: reportState.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: Color(0xFF0D9488)),
        ),
        error: (error, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.error_outline, size: 64, color: Colors.red.shade400),
                const SizedBox(height: 16),
                Text(
                  error.toString().replaceAll('Exception: ', ''),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 16, color: Colors.black87),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () => ref.invalidate(clinicalReportProvider(assessmentId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (report) => _buildReportContent(context, report),
      ),
    );
  }

  Widget _buildReportContent(BuildContext context, ClinicalReportModel report) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildSummaryCard(report),
          const SizedBox(height: 16),
          _buildMeasurementsCard(report),
          const SizedBox(height: 16),
          _buildProgressCard(report),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(ClinicalReportModel report) {
    return _buildCard(
      title: 'Assessment Summary',
      children: [
        _Row(label: 'Patient', value: '${report.patient.name} (${report.patient.patientCode})'),
        _Row(label: 'Wound Location', value: report.wound.location),
        _Row(label: 'Date', value: _formatDate(report.assessment.assessmentDate)),
        _Row(label: 'Status', value: report.assessment.status),
        _Row(
          label: 'Wound Detected',
          value: report.assessment.woundDetected == true ? 'Yes' : 'No',
          valueColor: report.assessment.woundDetected == true ? Colors.green.shade700 : Colors.red.shade700,
        ),
      ],
    );
  }

  Widget _buildMeasurementsCard(ClinicalReportModel report) {
    final m = report.assessment.measurements;
    if (m == null || m.isEmpty) {
      return _buildCard(
        title: 'Measurements',
        children: [const Text('No measurements available.', style: TextStyle(color: Colors.black54))],
      );
    }
    return _buildCard(
      title: 'Measurements',
      children: [
        _Row(label: 'Total Area', value: m['total_area_cm2'] != null ? '${m['total_area_cm2'].toStringAsFixed(2)} cm²' : 'N/A'),
        _Row(label: 'Total Perimeter', value: m['total_perimeter_cm'] != null ? '${m['total_perimeter_cm'].toStringAsFixed(2)} cm' : 'N/A'),
        _Row(label: 'Wound Count', value: '${m['wound_count'] ?? 'N/A'}'),
      ],
    );
  }

  Widget _buildProgressCard(ClinicalReportModel report) {
    final progress = report.progress;

    if (progress.previousAssessment == null) {
      return _buildCard(
        title: 'Clinical Progress',
        children: [
          const Text(
            'Not enough assessment data to show a progress chart.',
            style: TextStyle(color: Colors.black54, fontStyle: FontStyle.italic),
          ),
        ],
      );
    }

    Color statusColor = Colors.black87;
    if (progress.status == 'improving') statusColor = Colors.green;
    if (progress.status == 'worsening') statusColor = Colors.red;
    if (progress.status == 'stable') statusColor = Colors.blue;

    final changeText = progress.areaChangePct != null
        ? '${progress.areaChangePct! > 0 ? '+' : ''}${progress.areaChangePct!.toStringAsFixed(1)}%'
        : 'N/A';

    return _buildCard(
      title: 'Clinical Progress',
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Area Change', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
                Text(changeText, style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: statusColor)),
              ],
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                const Text('Status', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.w500)),
                Text(
                  progress.status.toUpperCase(),
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: statusColor),
                ),
              ],
            ),
          ],
        ),
        const Divider(height: 32),
        const Text('Historical Comparison', style: TextStyle(fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            _buildComparisonItem('Previous\n(${_formatDate(progress.previousAssessment!.date)})', '${progress.previousAssessment!.areaCm2.toStringAsFixed(2)} cm²'),
            const Icon(Icons.arrow_forward, color: Colors.grey),
            _buildComparisonItem('Current', progress.currentAreaCm2 != null ? '${progress.currentAreaCm2!.toStringAsFixed(2)} cm²' : 'N/A'),
          ],
        ),
      ],
    );
  }

  Widget _buildComparisonItem(String label, String value) {
    return Column(
      children: [
        Text(label, textAlign: TextAlign.center, style: const TextStyle(color: Colors.grey, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
      ],
    );
  }

  Widget _buildCard({required String title, required List<Widget> children}) {
    return Container(
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
          const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();
    return '${local.year}-${local.month.toString().padLeft(2, '0')}-${local.day.toString().padLeft(2, '0')}';
  }
}

class _Row extends StatelessWidget {
  final String label;
  final String value;
  final Color? valueColor;

  const _Row({required this.label, required this.value, this.valueColor});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(flex: 2, child: Text(label, style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w500))),
          Expanded(flex: 3, child: Text(value, style: TextStyle(fontWeight: FontWeight.bold, color: valueColor ?? const Color(0xFF0F172A)))),
        ],
      ),
    );
  }
}
