import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/dashboard_summary_model.dart';
import '../services/dashboard_service.dart';

final dashboardServiceProvider = Provider<DashboardService>((ref) {
  return DashboardService();
});

class DashboardState {
  final bool isLoading;
  final DashboardSummaryModel? summary;
  final String? error;

  const DashboardState({
    this.isLoading = false,
    this.summary,
    this.error,
  });

  DashboardState copyWith({
    bool? isLoading,
    DashboardSummaryModel? summary,
    String? error,
  }) {
    return DashboardState(
      isLoading: isLoading ?? this.isLoading,
      summary: summary ?? this.summary,
      error: error,
    );
  }
}

class DashboardNotifier extends Notifier<DashboardState> {
  @override
  DashboardState build() {
    Future.microtask(() => loadSummary());
    return const DashboardState(isLoading: true);
  }

  Future<void> loadSummary() async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final summary = await ref.read(dashboardServiceProvider).getSummary();
      state = DashboardState(isLoading: false, summary: summary);
    } catch (e) {
      state = DashboardState(
        isLoading: false,
        summary: null,
        error: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }
}

final dashboardProvider = NotifierProvider<DashboardNotifier, DashboardState>(() {
  return DashboardNotifier();
});
