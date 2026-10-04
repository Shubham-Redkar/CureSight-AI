import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../features/auth/providers/auth_provider.dart';
import '../../features/auth/ui/login_screen.dart';
import '../../features/dashboard/ui/dashboard_screen.dart';
import '../../features/patients/ui/patients_screen.dart';
import '../../features/patients/models/patient_model.dart';
import '../../features/wounds/ui/patient_details_screen.dart';
import '../../features/reports/ui/reports_screen.dart';
import '../../features/reports/ui/reports_list_screen.dart';
import '../../features/progress/ui/progress_screen.dart';
import '../../features/wounds/models/wound_model.dart';
import '../../features/assessments/models/assessment_model.dart';
import '../../features/assessments/ui/wound_details_screen.dart';
import '../../features/assessments/ui/assessment_detail_screen.dart';
import '../../features/assessments/ui/image_upload_screen.dart';
import '../../features/wounds/ui/tissue_analysis_screen.dart';

// Create a Listenable that notifies when authState changes
class RouterNotifier extends ChangeNotifier {
  final Ref _ref;
  RouterNotifier(this._ref) {
    _ref.listen<AuthState>(
      authProvider,
      (_, _) => notifyListeners(),
    );
  }
}

class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(color: Color(0xFF0D9488)),
      ),
    );
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final notifier = RouterNotifier(ref);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: notifier,
    redirect: (context, state) {
      // READ the state inside redirect, don't watch it!
      // This prevents GoRouter from being re-instantiated completely.
      final authState = ref.read(authProvider);
      
      final isAuth = authState.isAuthenticated;
      final isSplash = state.uri.path == '/splash';
      final isLoggingIn = state.uri.path == '/login';

      // 1. If initializing (checking auth), keep them on the splash screen
      if (authState.isInitializing) {
        return isSplash ? null : '/splash';
      }

      // 2. If NOT authenticated, they must be on /login
      if (!isAuth && !isLoggingIn) {
        return '/login';
      }

      // 3. If authenticated, they shouldn't be on /login or /splash
      if (isAuth && (isLoggingIn || isSplash)) {
        return '/dashboard';
      }

      // 4. Otherwise, let them go to the requested route
      return null;
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/dashboard',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/patients',
        builder: (context, state) => const PatientsScreen(),
        routes: [
          GoRoute(
            path: ':id',
            builder: (context, state) {
              final patient = state.extra as PatientModel;
              return PatientDetailsScreen(patient: patient);
            },
          ),
        ],
      ),
      GoRoute(
        path: '/reports',
        builder: (context, state) => const ReportsListScreen(),
      ),
      GoRoute(
        path: '/reports/:assessmentId',
        builder: (context, state) {
          final idStr = state.pathParameters['assessmentId'];
          final assessmentId = int.tryParse(idStr ?? '') ?? 0;
          return ReportsScreen(assessmentId: assessmentId);
        },
      ),
      GoRoute(
        path: '/wounds/:woundId/progress',
        builder: (context, state) {
          final woundIdStr = state.pathParameters['woundId'];
          final woundId = int.tryParse(woundIdStr ?? '') ?? 0;
          return ProgressScreen(woundId: woundId);
        },
      ),
      GoRoute(
        path: '/wounds/:id',
        builder: (context, state) {
          final wound = state.extra as WoundModel;
          return WoundDetailsScreen(wound: wound);
        },
      ),
      GoRoute(
        path: '/assessments/new',
        builder: (context, state) {
          final wound = state.extra as WoundModel;
          return ImageUploadScreen(wound: wound);
        },
      ),
      GoRoute(
        path: '/wounds/:woundId/tissue',
        builder: (context, state) {
          final wound = state.extra as WoundModel;
          return TissueAnalysisScreen(wound: wound);
        },
      ),
      GoRoute(
        path: '/assessments/:id',
        builder: (context, state) {
          final assessment = state.extra as AssessmentModel;
          return AssessmentDetailScreen(assessment: assessment);
        },
      ),
    ],
  );
});
