import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:intl/intl.dart';

import '../../assessments/providers/assessment_provider.dart';
import '../../assessments/models/assessment_model.dart';

class ProgressScreen extends ConsumerWidget {
  final int woundId;

  const ProgressScreen({super.key, required this.woundId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final state = ref.watch(assessmentsProvider(woundId));

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Progress Analytics'),
      ),
      body: state.when(
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
                  onPressed: () => ref.invalidate(assessmentsProvider(woundId)),
                  child: const Text('Retry'),
                ),
              ],
            ),
          ),
        ),
        data: (assessments) => _buildContent(context, assessments),
      ),
    );
  }

  Widget _buildContent(BuildContext context, List<AssessmentModel> assessments) {
    // 1. Filter and Sort
    final validAssessments = assessments
        .where((a) => a.status == 'COMPLETED' || a.status == 'VERIFIED')
        .toList()
      ..sort((a, b) => a.assessmentDate.compareTo(b.assessmentDate));

    if (validAssessments.isEmpty) {
      return const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.history, size: 80, color: Colors.grey),
            SizedBox(height: 16),
            Text(
              'No completed assessments available.',
              style: TextStyle(fontSize: 18, color: Colors.black54),
            ),
          ],
        ),
      );
    }

    // 2. Extract plottable points
    final chartPoints = <FlSpot>[];
    for (final a in validAssessments) {
      final effectiveWoundDetected = _getEffectiveWoundDetected(a);
      if (effectiveWoundDetected == true && a.measurements != null) {
        final area = a.measurements!['total_area_cm2'];
        if (area != null && area is num && area >= 0) {
          chartPoints.add(FlSpot(
            a.assessmentDate.millisecondsSinceEpoch.toDouble(),
            area.toDouble(),
          ));
        }
      }
    }

    return CustomScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      slivers: [
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text(
              'Wound ID: $woundId',
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
          ),
        ),
        if (chartPoints.length < 2)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(horizontal: 16.0, vertical: 32.0),
              child: Card(
                color: Colors.white,
                elevation: 0,
                child: Padding(
                  padding: EdgeInsets.all(24.0),
                  child: Column(
                    children: [
                      Icon(Icons.show_chart, size: 48, color: Colors.grey),
                      SizedBox(height: 16),
                      Text(
                        'Not enough historical measurements',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                        textAlign: TextAlign.center,
                      ),
                      SizedBox(height: 8),
                      Text(
                        'Multiple valid assessments are required to visualize area progression.',
                        style: TextStyle(color: Colors.black54),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          )
        else
          SliverToBoxAdapter(
            child: _buildChartAndSummary(chartPoints),
          ),
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(16, 24, 16, 12),
            child: Text(
              'Historical Ledger',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Color(0xFF0F172A)),
            ),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                // Display in reverse chronological order
                final item = validAssessments.reversed.toList()[index];
                return _buildLedgerCard(item);
              },
              childCount: validAssessments.length,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildChartAndSummary(List<FlSpot> points) {
    final firstPoint = points.first;
    final lastPoint = points.last;

    final baselineArea = firstPoint.y;
    final latestArea = lastPoint.y;
    final absoluteChange = latestArea - baselineArea;
    String percentageChangeStr = 'Unavailable';

    if (baselineArea > 0) {
      final percentageChange = (absoluteChange / baselineArea) * 100;
      final sign = percentageChange > 0 ? '+' : '';
      percentageChangeStr = '$sign${percentageChange.toStringAsFixed(1)}%';
    }

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: Card(
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
              side: BorderSide(color: Colors.grey.shade200),
            ),
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  const Text('Area change since first measurement', style: TextStyle(color: Colors.black54)),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      _buildMetricBox('Baseline Area', '${baselineArea.toStringAsFixed(1)} cm²'),
                      _buildMetricBox('Latest Area', '${latestArea.toStringAsFixed(1)} cm²'),
                      _buildMetricBox('Change', percentageChangeStr, 
                        color: percentageChangeStr.startsWith('-') ? Colors.green : (percentageChangeStr.startsWith('+') ? Colors.red : Colors.black87)
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: 16),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0),
          child: AspectRatio(
            aspectRatio: 1.5,
            child: Card(
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: BorderSide(color: Colors.grey.shade200),
              ),
              child: Padding(
                padding: const EdgeInsets.only(right: 24, left: 12, top: 24, bottom: 12),
                child: LineChart(
                  LineChartData(
                    gridData: FlGridData(
                      show: true,
                      drawVerticalLine: true,
                      horizontalInterval: _getHorizontalInterval(points),
                      getDrawingHorizontalLine: (value) => FlLine(color: Colors.grey.shade200, strokeWidth: 1),
                      getDrawingVerticalLine: (value) => FlLine(color: Colors.grey.shade200, strokeWidth: 1),
                    ),
                    titlesData: FlTitlesData(
                      show: true,
                      rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                      bottomTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 30,
                          interval: _getVerticalInterval(points),
                          getTitlesWidget: (value, meta) {
                            final date = DateTime.fromMillisecondsSinceEpoch(value.toInt());
                            return Padding(
                              padding: const EdgeInsets.only(top: 8.0),
                              child: Text(
                                DateFormat('MMM d').format(date),
                                style: const TextStyle(color: Colors.black54, fontSize: 10),
                              ),
                            );
                          },
                        ),
                      ),
                      leftTitles: AxisTitles(
                        sideTitles: SideTitles(
                          showTitles: true,
                          reservedSize: 40,
                          getTitlesWidget: (value, meta) {
                            return Text(
                              value.toStringAsFixed(1),
                              style: const TextStyle(color: Colors.black54, fontSize: 10),
                              textAlign: TextAlign.right,
                            );
                          },
                        ),
                      ),
                    ),
                    borderData: FlBorderData(show: true, border: Border.all(color: Colors.grey.shade200)),
                    minY: 0,
                    lineBarsData: [
                      LineChartBarData(
                        spots: points,
                        isCurved: false,
                        color: const Color(0xFF0D9488),
                        barWidth: 3,
                        isStrokeCapRound: true,
                        dotData: const FlDotData(show: true),
                        belowBarData: BarAreaData(
                          show: true,
                          color: const Color(0xFF0D9488).withValues(alpha: 0.1),
                        ),
                      ),
                    ],
                    lineTouchData: LineTouchData(
                      touchTooltipData: LineTouchTooltipData(
                        getTooltipItems: (touchedSpots) {
                          return touchedSpots.map((spot) {
                            final date = DateTime.fromMillisecondsSinceEpoch(spot.x.toInt());
                            return LineTooltipItem(
                              '${DateFormat('MMM d, yyyy').format(date)}\n',
                              const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                              children: [
                                TextSpan(
                                  text: '${spot.y.toStringAsFixed(1)} cm²',
                                  style: const TextStyle(color: Colors.white70, fontWeight: FontWeight.normal),
                                ),
                              ],
                            );
                          }).toList();
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  double _getHorizontalInterval(List<FlSpot> points) {
    if (points.isEmpty) return 1;
    final maxY = points.map((e) => e.y).reduce((a, b) => a > b ? a : b);
    if (maxY == 0) return 1;
    return (maxY / 4).ceilToDouble();
  }

  double _getVerticalInterval(List<FlSpot> points) {
    if (points.length < 2) return 1;
    final minX = points.first.x;
    final maxX = points.last.x;
    final diff = maxX - minX;
    if (diff == 0) return 1;
    // Show approx 4 labels on x axis
    return diff / 4;
  }

  Widget _buildMetricBox(String title, String value, {Color? color}) {
    return Column(
      children: [
        Text(title, style: TextStyle(color: Colors.grey.shade600, fontSize: 12)),
        const SizedBox(height: 4),
        Text(value, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: color ?? Colors.black87)),
      ],
    );
  }

  Widget _buildLedgerCard(AssessmentModel assessment) {
    final date = assessment.assessmentDate.toLocal();
    final dateString = DateFormat('MMM d, yyyy - HH:mm').format(date);
    
    final isVerified = assessment.verified;
    final woundDetected = _getEffectiveWoundDetected(assessment);
    
    num? area;
    num? perimeter;
    num? woundCount;

    if (woundDetected == true && assessment.measurements != null) {
      area = assessment.measurements!['total_area_cm2'];
      perimeter = assessment.measurements!['total_perimeter_cm'];
      woundCount = assessment.measurements!['wound_count'];
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 8.0),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: Colors.grey.shade200),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(dateString, style: const TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF0F172A))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: isVerified ? Colors.blue.shade50 : Colors.orange.shade50,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(
                        isVerified ? Icons.verified : Icons.pending_actions,
                        size: 14,
                        color: isVerified ? Colors.blue : Colors.orange,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isVerified ? 'Verified' : 'AI Result / Unverified',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                          color: isVerified ? Colors.blue : Colors.orange,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (woundDetected == false)
              const Text('Clinical Event: No wound detected', style: TextStyle(color: Colors.black87, fontStyle: FontStyle.italic))
            else ...[
              Row(
                children: [
                  _buildLedgerDetail('Area', area != null ? '${area.toStringAsFixed(1)} cm²' : 'N/A'),
                  const SizedBox(width: 16),
                  _buildLedgerDetail('Perimeter', perimeter != null ? '${perimeter.toStringAsFixed(1)} cm' : 'N/A'),
                  const SizedBox(width: 16),
                  _buildLedgerDetail('Count', woundCount?.toString() ?? 'N/A'),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildLedgerDetail(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(color: Colors.grey.shade500, fontSize: 12)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Colors.black87, fontSize: 14)),
      ],
    );
  }

  bool? _getEffectiveWoundDetected(AssessmentModel a) {
    if (a.verified && a.verifiedResult != null && a.verifiedResult!.containsKey('woundDetected')) {
      final override = a.verifiedResult!['woundDetected'];
      if (override is bool) return override;
    }
    return a.woundDetected;
  }
}
