import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../models/user_model.dart';
import '../services/auth_service.dart';

// Provides the singleton AuthService
final authServiceProvider = Provider<AuthService>((ref) {
  return AuthService();
});

// Represents the state of authentication
class AuthState {
  final bool isLoading;
  final bool isInitializing;
  final UserModel? user;
  final String? error;

  const AuthState({
    this.isLoading = false,
    this.isInitializing = false,
    this.user,
    this.error,
  });

  bool get isAuthenticated => user != null;

  AuthState copyWith({
    bool? isLoading,
    bool? isInitializing,
    UserModel? user,
    String? error,
  }) {
    return AuthState(
      isLoading: isLoading ?? this.isLoading,
      isInitializing: isInitializing ?? this.isInitializing,
      user: user ?? this.user,
      error: error,
    );
  }
}

class AuthNotifier extends Notifier<AuthState> {
  @override
  AuthState build() {
    // Schedule checkAuth after build
    Future.microtask(() => checkAuth());
    return const AuthState(isInitializing: true);
  }

  Future<void> checkAuth() async {
    state = state.copyWith(isInitializing: true, error: null);
    try {
      final user = await ref.read(authServiceProvider).checkAuth();
      state = AuthState(isInitializing: false, user: user);
    } catch (e) {
      state = const AuthState(isInitializing: false, user: null);
    }
  }

  Future<void> login(String username, String password) async {
    state = state.copyWith(isLoading: true, error: null);
    try {
      final user = await ref.read(authServiceProvider).login(username, password);
      state = AuthState(isInitializing: false, isLoading: false, user: user);
    } catch (e) {
      state = AuthState(
        isInitializing: false,
        isLoading: false,
        user: null,
        error: e.toString().replaceAll('Exception: ', ''),
      );
    }
  }

  Future<void> logout() async {
    state = state.copyWith(isLoading: true);
    await ref.read(authServiceProvider).logout();
    state = const AuthState(isInitializing: false, isLoading: false, user: null);
  }
}

final authProvider = NotifierProvider<AuthNotifier, AuthState>(() {
  return AuthNotifier();
});
