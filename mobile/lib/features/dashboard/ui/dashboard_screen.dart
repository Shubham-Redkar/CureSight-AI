import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../auth/providers/auth_provider.dart';
import '../../assessments/models/assessment_model.dart';
import '../../../core/widgets/app_drawer.dart';
import '../providers/dashboard_provider.dart';
import '../models/dashboard_summary_model.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(dashboardProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('CureSight AI Dashboard'),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: 'Logout',
            onPressed: () {
              ref.read(authProvider.notifier).logout();
            },
          ),
        ],
      ),
      drawer: const AppDrawer(),
      body: RefreshIndicator(
        onRefresh: () => ref.read(dashboardProvider.notifier).loadSummary(),
        child: _buildBody(context, state, ref),
      ),
    );
  }

  Widget _buildBody(BuildContext context, DashboardState state, WidgetRef ref) {
    if (state.isLoading && state.summary == null) {
      return const Center(child: CircularProgressIndicator(color: Color(0xFF0D9488)));
    }

    if (state.error != null && state.summary == null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.error_outline, size: 64, color: Colors.red.shade400),
              const SizedBox(height: 16),
              Text(
                state.error!,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 16, color: Colors.black87),
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: () => ref.read(dashboardProvider.notifier).loadSummary(),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
      );
    }

    final summary = state.summary;
    if (summary == null) {
      return const Center(child: Text('No data available.'));
    }

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Overview',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 16),
                _buildStatCards(summary),
                const SizedBox(height: 32),
                const Text(
                  'Recent Assessments',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
        if (summary.recentAssessments.isEmpty)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.all(32.0),
              child: Center(
                child: Text('No recent assessments found.', style: TextStyle(color: Colors.black54)),
              ),
            ),
          )
        else
          SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final assessment = summary.recentAssessments[index];
                return _buildAssessmentCard(context, assessment);
              },
              childCount: summary.recentAssessments.length,
            ),
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }

  Widget _buildStatCards(DashboardSummaryModel summary) {
    return LayoutBuilder(builder: (context, constraints) {
      final width = (constraints.maxWidth - 16) / 2;
      return Wrap(
        spacing: 16,
        runSpacing: 16,
        children: [
          _StatCard(
            title: 'Total Patients', 
            value: summary.totalPatients.toString(), 
            icon: Icons.people, 
            width: width, 
            color: Colors.blue.shade700,
            onTap: () => context.push('/patients'),
          ),
          _StatCard(title: 'Active Wounds', value: summary.activeWounds.toString(), icon: Icons.healing, width: width, color: Colors.orange.shade700),
          _StatCard(title: 'Pending Review', value: summary.pendingReview.toString(), icon: Icons.pending_actions, width: width, color: Colors.amber.shade700),
          _StatCard(title: 'Verified', value: summary.verifiedAssessments.toString(), icon: Icons.check_circle, width: width, color: Colors.green.shade700),
        ],
      );
    });
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  Widget _buildAssessmentCard(BuildContext context, RecentAssessmentModel assessment) {
    final patientName = assessment.wound?.patient?.name ?? 'Unknown Patient';
    final location = assessment.wound?.location ?? 'Unknown Location';
    final date = _formatDate(assessment.assessmentDate.toLocal());
    final isVerified = assessment.verified;
    
    Color statusColor = Colors.grey;
    if (assessment.status == 'COMPLETED') statusColor = Colors.green;
    if (assessment.status == 'PENDING') statusColor = Colors.amber;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: ListTile(
        contentPadding: const EdgeInsets.all(16.0),
        leading: CircleAvatar(
          backgroundColor: const Color(0xFFF1F5F9),
          child: Icon(Icons.assignment, color: statusColor),
        ),
        title: Text(patientName, style: const TextStyle(fontWeight: FontWeight.bold)),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 8.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Wound: $location'),
              const SizedBox(height: 4),
              Text(date, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
            ],
          ),
        ),
        trailing: isVerified 
          ? const Icon(Icons.verified, color: Colors.blue) 
          : null,
        onTap: () {
          final assessmentModel = AssessmentModel(
            id: assessment.id,
            woundId: assessment.woundId,
            assessmentDate: assessment.assessmentDate,
            status: assessment.status,
            verified: assessment.verified,
          );
          
          context.push(
            '/assessments/${assessment.id}',
            extra: assessmentModel,
          );
        },
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  final String title;
  final String value;
  final IconData icon;
  final double width;
  final Color color;
  final VoidCallback? onTap;

  const _StatCard({
    required this.title,
    required this.value,
    required this.icon,
    required this.width,
    required this.color,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey.shade200),
        boxShadow: const [
          BoxShadow(
            color: Color(0x08000000), // 3% opacity black
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(icon, color: color, size: 28),
                const SizedBox(height: 16),
                Text(
                  value,
                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: TextStyle(fontSize: 14, color: Colors.grey.shade600),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
