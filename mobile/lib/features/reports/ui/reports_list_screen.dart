import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/widgets/app_drawer.dart';
import '../models/report_list_model.dart';
import '../providers/report_provider.dart';

class ReportsListScreen extends ConsumerWidget {
  const ReportsListScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(reportListProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Clinical Reports'),
      ),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(reportListProvider),
        child: _buildBody(context, state, ref),
      ),
    );
  }

  Widget _buildBody(BuildContext context, AsyncValue<List<ReportListItemModel>> state, WidgetRef ref) {
    return state.when(
      loading: () => const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488))),
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
                onPressed: () => ref.invalidate(reportListProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      ),
      data: (reports) {
        if (reports.isEmpty) {
          return CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverFillRemaining(
                child: Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.assessment_outlined, size: 80, color: Colors.grey.shade400),
                      const SizedBox(height: 16),
                      const Text(
                        'No clinical reports available yet.',
                        style: TextStyle(fontSize: 18, color: Colors.black54),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        }

        return ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 16),
          itemCount: reports.length,
          itemBuilder: (context, index) {
            return _buildReportCard(context, reports[index]);
          },
        );
      },
    );
  }

  Widget _buildReportCard(BuildContext context, ReportListItemModel report) {
    final date = _formatDate(report.assessmentDate.toLocal());
    final patientName = report.wound.patient.name;
    final patientCode = report.wound.patient.patientCode;
    final location = report.wound.location;
    final isVerified = report.verified;

    Color statusColor = Colors.grey;
    if (report.status == 'COMPLETED') statusColor = Colors.green;
    if (report.status == 'PENDING') statusColor = Colors.amber;

    return Card(
      margin: const EdgeInsets.only(bottom: 12.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: InkWell(
        onTap: () => context.push('/reports/${report.id}'),
        borderRadius: BorderRadius.circular(12),
        child: ListTile(
          contentPadding: const EdgeInsets.all(16.0),
          leading: CircleAvatar(
            backgroundColor: const Color(0xFFF1F5F9),
            child: Icon(Icons.assessment, color: statusColor),
          ),
          title: Text(patientName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          subtitle: Padding(
            padding: const EdgeInsets.only(top: 8.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.badge, size: 14, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(patientCode, style: TextStyle(color: Colors.grey.shade700)),
                  ],
                ),
                const SizedBox(height: 4),
                Text('Wound: $location', style: TextStyle(color: Colors.grey.shade800)),
                const SizedBox(height: 4),
                Text(date, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
              ],
            ),
          ),
          trailing: isVerified 
              ? const Icon(Icons.verified, color: Colors.blue) 
              : null,
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}
